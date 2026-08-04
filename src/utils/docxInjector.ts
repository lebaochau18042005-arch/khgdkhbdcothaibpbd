import JSZip from "jszip";

export interface Snippet {
    activityName: string;
    text: string;
}

export async function injectSnippetsIntoDocx(file: File, snippets: Snippet[]): Promise<Blob> {
    const zip = await JSZip.loadAsync(file);
    const xmlContent = await zip.file("word/document.xml")?.async("string");
    
    if (!xmlContent) {
        throw new Error("Không tìm thấy word/document.xml");
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "application/xml");
    const paragraphs = xmlDoc.getElementsByTagName("w:p");

    for (const snippet of snippets) {
        let targetP: Element | null = null;
        for (let i = 0; i < paragraphs.length; i++) {
            const text = paragraphs[i].textContent || "";
            // Remove spaces and lowercase to compare robustly
            const cleanText = text.toLowerCase().replace(/\s+/g, '');
            const cleanActivity = snippet.activityName.toLowerCase().replace(/\s+/g, '');
            
            if (cleanText.includes(cleanActivity) && cleanActivity.length > 5) {
                targetP = paragraphs[i];
                break; // insert after the FIRST matching paragraph (usually the title of the activity)
            }
        }

        if (targetP) {
            // Create a new paragraph with red text
            const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
            
            // Split snippet text by newlines to create multiple w:t with w:br
            const lines = snippet.text.split('\n');
            
            const newP = xmlDoc.createElementNS(ns, "w:p");
            const newR = xmlDoc.createElementNS(ns, "w:r");
            const newRPr = xmlDoc.createElementNS(ns, "w:rPr");
            
            const color = xmlDoc.createElementNS(ns, "w:color");
            color.setAttribute("w:val", "FF0000"); // Red
            newRPr.appendChild(color);
            
            const bold = xmlDoc.createElementNS(ns, "w:b");
            newRPr.appendChild(bold);
            
            newR.appendChild(newRPr);
            
            for (let i = 0; i < lines.length; i++) {
                const wT = xmlDoc.createElementNS(ns, "w:t");
                wT.textContent = lines[i];
                newR.appendChild(wT);
                
                if (i < lines.length - 1) {
                    const br = xmlDoc.createElementNS(ns, "w:br");
                    newR.appendChild(br);
                }
            }
            
            newP.appendChild(newR);
            targetP.parentNode?.insertBefore(newP, targetP.nextSibling);
        }
    }

    const serializer = new XMLSerializer();
    const newXml = serializer.serializeToString(xmlDoc);
    zip.file("word/document.xml", newXml);

    return await zip.generateAsync({ type: "blob" });
}
