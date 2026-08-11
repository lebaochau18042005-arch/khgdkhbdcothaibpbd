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
    preservationReport: PreservationReport;
}

export interface InjectionOptions {
    objectivesText?: string;
    assessmentText?: string;
}

export interface PreservationReport {
    status: "passed" | "warning";
    originalPackageParts: number;
    outputPackageParts: number;
    mediaParts: number;
    chartParts: number;
    diagramParts: number;
    embeddedParts: number;
    tableCount: number;
    drawingCount: number;
    mathCount: number;
    lostPackageParts: string[];
    warnings: string[];
}

interface XmlStructureStats {
    tableCount: number;
    drawingCount: number;
    mathCount: number;
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

function getPackageParts(zip: JSZip): string[] {
    return Object.values(zip.files)
        .filter(part => !part.dir)
        .map(part => part.name);
}

function countPackageParts(parts: string[], matchers: RegExp[]): number {
    return parts.filter(part => matchers.some(pattern => pattern.test(part))).length;
}

function countXmlStructure(xmlDoc: Document): XmlStructureStats {
    return {
        tableCount: xmlDoc.getElementsByTagName("w:tbl").length,
        drawingCount:
            xmlDoc.getElementsByTagName("w:drawing").length +
            xmlDoc.getElementsByTagName("w:pict").length +
            xmlDoc.getElementsByTagName("v:shape").length,
        mathCount:
            xmlDoc.getElementsByTagName("m:oMath").length +
            xmlDoc.getElementsByTagName("m:oMathPara").length
    };
}

function buildPreservationReport(
    originalParts: string[],
    outputParts: string[],
    originalStats: XmlStructureStats,
    outputStats: XmlStructureStats
): PreservationReport {
    const outputPartSet = new Set(outputParts);
    const lostPackageParts = originalParts.filter(part => !outputPartSet.has(part));
    const warnings: string[] = [];

    if (lostPackageParts.length > 0) {
        warnings.push("Có thành phần trong gói DOCX gốc không còn trong file sau khi chèn.");
    }
    if (outputStats.tableCount < originalStats.tableCount) {
        warnings.push("Số bảng trong giáo án bị giảm.");
    }
    if (outputStats.drawingCount < originalStats.drawingCount) {
        warnings.push("Số hình ảnh/hình vẽ trong nội dung chính bị giảm.");
    }
    if (outputStats.mathCount < originalStats.mathCount) {
        warnings.push("Số công thức toán học trong nội dung chính bị giảm.");
    }

    return {
        status: warnings.length > 0 ? "warning" : "passed",
        originalPackageParts: originalParts.length,
        outputPackageParts: outputParts.length,
        mediaParts: countPackageParts(outputParts, [/^word\/media\//i]),
        chartParts: countPackageParts(outputParts, [/^word\/charts\//i]),
        diagramParts: countPackageParts(outputParts, [/^word\/diagrams\//i, /^word\/drawings\//i]),
        embeddedParts: countPackageParts(outputParts, [/^word\/embeddings\//i, /^word\/activeX\//i]),
        tableCount: outputStats.tableCount,
        drawingCount: outputStats.drawingCount,
        mathCount: outputStats.mathCount,
        lostPackageParts,
        warnings
    };
}

function getTopLevelBodyChild(node: Element, body: Element): Element | null {
    let current: Node | null = node;
    while (current?.parentNode && current.parentNode !== body) {
        current = current.parentNode;
    }
    return current instanceof Element && current.parentNode === body ? current : null;
}

function insertBodyElementsAfter(xmlDoc: Document, reference: Element | null, elements: Element[]): boolean {
    const body = xmlDoc.getElementsByTagName("w:body")[0];
    if (!body || elements.length === 0) return false;

    const anchor = reference?.parentNode === body ? reference.nextSibling : null;
    const fallbackAnchor = Array.from(body.children).find(child => child.tagName === "w:sectPr") || null;
    const beforeNode = anchor || fallbackAnchor;

    for (const element of elements) {
        body.insertBefore(element, beforeNode);
    }
    return !!reference;
}

function createStyledParagraph(xmlDoc: Document, text: string, colorValue: string, boldText = false, leftIndent = "360"): Element {
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const paragraph = xmlDoc.createElementNS(ns, "w:p");

    const pPr = xmlDoc.createElementNS(ns, "w:pPr");
    const ind = xmlDoc.createElementNS(ns, "w:ind");
    ind.setAttribute("w:left", leftIndent);
    pPr.appendChild(ind);
    paragraph.appendChild(pPr);

    const run = xmlDoc.createElementNS(ns, "w:r");
    const rPr = xmlDoc.createElementNS(ns, "w:rPr");
    const fonts = xmlDoc.createElementNS(ns, "w:rFonts");
    fonts.setAttribute("w:ascii", "Times New Roman");
    fonts.setAttribute("w:hAnsi", "Times New Roman");
    fonts.setAttribute("w:cs", "Times New Roman");
    rPr.appendChild(fonts);
    const color = xmlDoc.createElementNS(ns, "w:color");
    color.setAttribute("w:val", colorValue);
    rPr.appendChild(color);
    if (boldText) {
        const bold = xmlDoc.createElementNS(ns, "w:b");
        rPr.appendChild(bold);
    }
    const sz = xmlDoc.createElementNS(ns, "w:sz");
    sz.setAttribute("w:val", "22");
    rPr.appendChild(sz);
    run.appendChild(rPr);

    const wT = xmlDoc.createElementNS(ns, "w:t");
    wT.textContent = text;
    wT.setAttribute("xml:space", "preserve");
    run.appendChild(wT);

    paragraph.appendChild(run);
    return paragraph;
}

function createStyledBlock(xmlDoc: Document, label: string, text: string, colorValue: string): Element[] {
    const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
    return [
        createStyledParagraph(xmlDoc, label, colorValue, true, "0"),
        ...lines.map(line => createStyledParagraph(xmlDoc, line, colorValue, false, "360"))
    ];
}

function insertBlockNearHeading(
    xmlDoc: Document,
    paragraphs: HTMLCollectionOf<Element>,
    headingKeywords: string[],
    label: string,
    text: string,
    colorValue: string
): boolean {
    const body = xmlDoc.getElementsByTagName("w:body")[0];
    if (!body || !text.trim()) return false;

    const normalizedKeywords = headingKeywords.map(normalizeVietnamese);
    let target: Element | null = null;
    for (let i = 0; i < paragraphs.length; i++) {
        const paragraphText = normalizeVietnamese(paragraphs[i].textContent || "");
        if (normalizedKeywords.some(keyword => paragraphText.includes(keyword))) {
            target = paragraphs[i];
            break;
        }
    }

    const reference = target ? getTopLevelBodyChild(target, body) : null;
    return insertBodyElementsAfter(xmlDoc, reference, createStyledBlock(xmlDoc, label, text, colorValue));
}

export async function injectSnippetsIntoDocx(file: File, snippets: Snippet[], options: InjectionOptions = {}): Promise<InjectionResult> {
    const zip = await JSZip.loadAsync(file);
    const originalPackageParts = getPackageParts(zip);
    const xmlContent = await zip.file("word/document.xml")?.async("string");
    
    if (!xmlContent) {
        throw new Error("Không tìm thấy word/document.xml trong file DOCX này. File có thể bị hỏng.");
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "application/xml");
    const paragraphs = xmlDoc.getElementsByTagName("w:p");
    const originalStats = countXmlStructure(xmlDoc);

    let injectedCount = 0;
    const skippedActivities: string[] = [];
    const previewItems: InjectionResult["previewItems"] = [];

    if (options.objectivesText?.trim()) {
        const found = insertBlockNearHeading(
            xmlDoc,
            paragraphs,
            ["mục tiêu", "muc tieu", "i. mục tiêu", "i mục tiêu"],
            "[MỤC TIÊU BỔ SUNG NLS/NL AI]",
            options.objectivesText,
            "C0392B"
        );
        previewItems.push({
            activityName: "I. MỤC TIÊU - bổ sung NLS/NL AI",
            injectedText: options.objectivesText,
            found
        });
        injectedCount++;
    }

    if (options.assessmentText?.trim()) {
        const found = insertBlockNearHeading(
            xmlDoc,
            paragraphs,
            ["đánh giá", "danh gia", "kiểm tra", "kiem tra"],
            "[GỢI Ý ĐÁNH GIÁ NLS/NL AI]",
            options.assessmentText,
            "1E40AF"
        );
        previewItems.push({
            activityName: "IV. ĐÁNH GIÁ - bổ sung tiêu chí NLS/NL AI",
            injectedText: options.assessmentText,
            found
        });
        injectedCount++;
    }

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
            const body = xmlDoc.getElementsByTagName("w:body")[0];
            const reference = body ? getTopLevelBodyChild(bestP, body) : null;
            insertBodyElementsAfter(
                xmlDoc,
                reference,
                createStyledBlock(xmlDoc, `[TÍCH HỢP AI - QĐ 3439] ${snippet.activityName}`, snippet.text, "C0392B")
            );
            
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
                insertBodyElementsAfter(
                    xmlDoc,
                    null,
                    createStyledBlock(xmlDoc, `[TÍCH HỢP AI - ${snippet.activityName}]`, snippet.text, "E74C3C")
                );
                injectedCount++;
            }
        }
    }

    const serializer = new XMLSerializer();
    const newXml = serializer.serializeToString(xmlDoc);
    zip.file("word/document.xml", newXml);
    const outputStats = countXmlStructure(xmlDoc);
    const outputPackageParts = getPackageParts(zip);
    const preservationReport = buildPreservationReport(
        originalPackageParts,
        outputPackageParts,
        originalStats,
        outputStats
    );

    if (preservationReport.status !== "passed") {
        const details = preservationReport.warnings.join(" ");
        throw new Error(`Không xuất file vì kiểm tra bảo toàn giáo án gốc chưa đạt. ${details}`);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    return { blob, injectedCount, skippedActivities, previewItems, preservationReport };
}
