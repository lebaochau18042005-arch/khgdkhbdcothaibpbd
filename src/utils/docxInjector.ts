import JSZip from "jszip";

export interface Snippet {
    activityName: string;
    text: string;
}

export interface InjectionResult {
    blob: Blob;
    injectedCount: number;
    skippedActivities: string[];
    previewItems: Array<{ activityName: string; injectedText: string; found: boolean }>;
}

// More robust text normalizer for Vietnamese
function normalizeVietnamese(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove diacritics
        .replace(/đ/g, "d")
        .replace(/\s+/g, " ")
        .trim();
}

// Score how well a paragraph text matches an activity name
function matchScore(paragraphText: string, activityName: string): number {
    const normPara = normalizeVietnamese(paragraphText);
    const normActivity = normalizeVietnamese(activityName);
    
    // Exact contains
    if (normPara.includes(normActivity)) return 100;
    
    // Split activity into keywords, check how many appear
    const keywords = normActivity.split(/\s+/).filter(k => k.length > 3);
    if (keywords.length === 0) return 0;
    const matchedKeywords = keywords.filter(k => normPara.includes(k));
    const ratio = matchedKeywords.length / keywords.length;
    
    // Require at least 60% keyword match
    return ratio >= 0.6 ? Math.round(ratio * 80) : 0;
}

export async function injectSnippetsIntoDocx(file: File, snippets: Snippet[]): Promise<InjectionResult> {
    const zip = await JSZip.loadAsync(file);
    const xmlContent = await zip.file("word/document.xml")?.async("string");
    
    if (!xmlContent) {
        throw new Error("Không tìm thấy word/document.xml trong file DOCX này. File có thể bị hỏng.");
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "application/xml");
    const paragraphs = xmlDoc.getElementsByTagName("w:p");

    let injectedCount = 0;
    const skippedActivities: string[] = [];
    const previewItems: InjectionResult["previewItems"] = [];

    for (const snippet of snippets) {
        let bestP: Element | null = null;
        let bestScore = 0;
        
        // Find best matching paragraph
        for (let i = 0; i < paragraphs.length; i++) {
            const text = paragraphs[i].textContent || "";
            if (text.trim().length < 3) continue;
            
            const score = matchScore(text, snippet.activityName);
            if (score > bestScore) {
                bestScore = score;
                bestP = paragraphs[i];
            }
        }

        if (bestP && bestScore >= 40) {
            // Create new paragraph with styled AI content
            const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
            
            const newP = xmlDoc.createElementNS(ns, "w:p");
            
            // Paragraph properties - indent slightly
            const pPr = xmlDoc.createElementNS(ns, "w:pPr");
            const ind = xmlDoc.createElementNS(ns, "w:ind");
            ind.setAttribute("w:left", "360");
            pPr.appendChild(ind);
            newP.appendChild(pPr);

            const newR = xmlDoc.createElementNS(ns, "w:r");
            const newRPr = xmlDoc.createElementNS(ns, "w:rPr");
            
            // Red color
            const color = xmlDoc.createElementNS(ns, "w:color");
            color.setAttribute("w:val", "C0392B");
            newRPr.appendChild(color);
            
            // Bold
            const bold = xmlDoc.createElementNS(ns, "w:b");
            newRPr.appendChild(bold);
            
            // Font size 22 (11pt)
            const sz = xmlDoc.createElementNS(ns, "w:sz");
            sz.setAttribute("w:val", "22");
            newRPr.appendChild(sz);

            newR.appendChild(newRPr);
            
            // Add header label
            const headerT = xmlDoc.createElementNS(ns, "w:t");
            headerT.textContent = "🤖 [TÍCH HỢP AI - QĐ 3439] ";
            headerT.setAttribute("xml:space", "preserve");
            newR.appendChild(headerT);
            
            // Add content lines
            const lines = snippet.text.split('\n').filter(l => l.trim());
            for (let i = 0; i < lines.length; i++) {
                if (i > 0) {
                    const br = xmlDoc.createElementNS(ns, "w:br");
                    newR.appendChild(br);
                }
                const wT = xmlDoc.createElementNS(ns, "w:t");
                wT.textContent = lines[i];
                wT.setAttribute("xml:space", "preserve");
                newR.appendChild(wT);
            }
            
            newP.appendChild(newR);
            bestP.parentNode?.insertBefore(newP, bestP.nextSibling);
            
            injectedCount++;
            previewItems.push({
                activityName: snippet.activityName,
                injectedText: snippet.text,
                found: true
            });
        } else {
            // Activity not found - append at end of document as fallback
            skippedActivities.push(snippet.activityName);
            previewItems.push({
                activityName: snippet.activityName,
                injectedText: snippet.text,
                found: false
            });
            
            // Fallback: append at end of body
            const body = xmlDoc.getElementsByTagName("w:body")[0];
            if (body) {
                const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
                const fallbackP = xmlDoc.createElementNS(ns, "w:p");
                const fallbackR = xmlDoc.createElementNS(ns, "w:r");
                const fallbackRPr = xmlDoc.createElementNS(ns, "w:rPr");
                const color = xmlDoc.createElementNS(ns, "w:color");
                color.setAttribute("w:val", "E74C3C");
                fallbackRPr.appendChild(color);
                const bold = xmlDoc.createElementNS(ns, "w:b");
                fallbackRPr.appendChild(bold);
                fallbackR.appendChild(fallbackRPr);
                const wT = xmlDoc.createElementNS(ns, "w:t");
                wT.textContent = `🤖 [AI - ${snippet.activityName}]: ${snippet.text}`;
                wT.setAttribute("xml:space", "preserve");
                fallbackR.appendChild(wT);
                fallbackP.appendChild(fallbackR);
                // Insert before last paragraph (sectPr)
                const lastP = body.lastElementChild;
                body.insertBefore(fallbackP, lastP);
                injectedCount++;
            }
        }
    }

    const serializer = new XMLSerializer();
    const newXml = serializer.serializeToString(xmlDoc);
    zip.file("word/document.xml", newXml);

    const blob = await zip.generateAsync({ type: "blob" });
    return { blob, injectedCount, skippedActivities, previewItems };
}
