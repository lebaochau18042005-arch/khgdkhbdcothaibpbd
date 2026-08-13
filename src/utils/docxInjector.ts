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

function extractActivityNumber(text: string): string | null {
    const match = normalizeVietnamese(text).match(/\b(?:hoat dong|hd)\s*(\d+)/i);
    return match?.[1] || null;
}

function looksLikeActivityHeading(text: string): boolean {
    const normalized = normalizeVietnamese(text);
    return /\b(?:hoat dong|hd)\s*\d+/i.test(normalized) ||
        /\b(khoi dong|hinh thanh kien thuc|luyen tap|van dung)\b/i.test(normalized);
}

function activityAnchorScore(paragraphText: string, activityName: string): number {
    let score = matchScore(paragraphText, activityName);
    const paragraphActivityNumber = extractActivityNumber(paragraphText);
    const snippetActivityNumber = extractActivityNumber(activityName);

    if (snippetActivityNumber && paragraphActivityNumber) {
        score += snippetActivityNumber === paragraphActivityNumber ? 60 : -50;
    }
    if (looksLikeActivityHeading(paragraphText)) {
        score += 20;
    }
    if ((paragraphText || "").length > 260) {
        score -= 10;
    }

    return Math.max(0, score);
}

function findBestActivityParagraph(paragraphs: HTMLCollectionOf<Element>, activityName: string): { paragraph: Element | null; score: number } {
    let bestP: Element | null = null;
    let bestScore = 0;

    for (let i = 0; i < paragraphs.length; i++) {
        const text = paragraphs[i].textContent || "";
        if (text.trim().length < 3) continue;

        const score = activityAnchorScore(text, activityName);
        if (score > bestScore) {
            bestScore = score;
            bestP = paragraphs[i];
        }
    }

    return { paragraph: bestP, score: bestScore };
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

function emptyXmlStats(): XmlStructureStats {
    return { tableCount: 0, drawingCount: 0, mathCount: 0 };
}

function addXmlStats(a: XmlStructureStats, b: XmlStructureStats): XmlStructureStats {
    return {
        tableCount: a.tableCount + b.tableCount,
        drawingCount: a.drawingCount + b.drawingCount,
        mathCount: a.mathCount + b.mathCount
    };
}

async function countWordXmlStructures(zip: JSZip, overrides: Record<string, string> = {}): Promise<XmlStructureStats> {
    const parser = new DOMParser();
    const xmlPartNames = getPackageParts(zip).filter(part =>
        /^word\/.*\.xml$/i.test(part) && !/^word\/_rels\//i.test(part)
    );
    let stats = emptyXmlStats();

    for (const partName of xmlPartNames) {
        const xml = overrides[partName] ?? await zip.file(partName)?.async("string");
        if (!xml) continue;
        const xmlDoc = parser.parseFromString(xml, "application/xml");
        stats = addXmlStats(stats, countXmlStructure(xmlDoc));
    }

    return stats;
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

function insertBodyElementsBefore(xmlDoc: Document, reference: Element | null, elements: Element[]): boolean {
    const body = xmlDoc.getElementsByTagName("w:body")[0];
    if (!body || elements.length === 0) return false;

    const beforeNode = reference?.parentNode === body
        ? reference
        : Array.from(body.children).find(child => child.tagName === "w:sectPr") || null;

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
    wT.textContent = cleanInjectedText(text);
    wT.setAttribute("xml:space", "preserve");
    run.appendChild(wT);

    paragraph.appendChild(run);
    return paragraph;
}

function cleanInjectedText(text: string): string {
    return (text || "")
        .replace(/<\/?ai>/gi, "")
        .replace(/<\/?bold>/gi, "")
        .replace(/\*\*/g, "")
        .trim();
}

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function createWordElement(xmlDoc: Document, tagName: string): Element {
    return xmlDoc.createElementNS(WORD_NS, tagName);
}

function isPipeTableLine(line: string): boolean {
    if (!line.includes("|")) return false;
    return splitPipeTableRow(line).length >= 2;
}

function isMarkdownTableSeparator(line: string): boolean {
    const cells = splitPipeTableRow(line);
    return cells.length >= 2 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitPipeTableRow(line: string): string[] {
    return cleanInjectedText(line)
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map(cell => cell.trim());
}

function normalizeTableRows(rows: string[][]): string[][] {
    const columnCount = Math.max(...rows.map(row => row.length), 0);
    return rows.map(row => [
        ...row,
        ...Array(Math.max(0, columnCount - row.length)).fill("")
    ].slice(0, columnCount));
}

function createTableCellParagraph(xmlDoc: Document, text: string, colorValue: string, boldText = false): Element {
    const paragraph = createWordElement(xmlDoc, "w:p");
    const run = createWordElement(xmlDoc, "w:r");
    const rPr = createWordElement(xmlDoc, "w:rPr");

    const fonts = createWordElement(xmlDoc, "w:rFonts");
    fonts.setAttribute("w:ascii", "Times New Roman");
    fonts.setAttribute("w:hAnsi", "Times New Roman");
    fonts.setAttribute("w:cs", "Times New Roman");
    rPr.appendChild(fonts);

    const color = createWordElement(xmlDoc, "w:color");
    color.setAttribute("w:val", colorValue);
    rPr.appendChild(color);

    if (boldText) {
        rPr.appendChild(createWordElement(xmlDoc, "w:b"));
    }

    const sz = createWordElement(xmlDoc, "w:sz");
    sz.setAttribute("w:val", "20");
    rPr.appendChild(sz);

    run.appendChild(rPr);

    const wT = createWordElement(xmlDoc, "w:t");
    wT.textContent = cleanInjectedText(text);
    wT.setAttribute("xml:space", "preserve");
    run.appendChild(wT);
    paragraph.appendChild(run);

    return paragraph;
}

function createTableCell(xmlDoc: Document, text: string, colorValue: string, boldText: boolean, columnWidth: number): Element {
    const cell = createWordElement(xmlDoc, "w:tc");
    const tcPr = createWordElement(xmlDoc, "w:tcPr");

    const tcW = createWordElement(xmlDoc, "w:tcW");
    tcW.setAttribute("w:w", String(columnWidth));
    tcW.setAttribute("w:type", "dxa");
    tcPr.appendChild(tcW);

    if (boldText) {
        const shd = createWordElement(xmlDoc, "w:shd");
        shd.setAttribute("w:val", "clear");
        shd.setAttribute("w:color", "auto");
        shd.setAttribute("w:fill", "F8FAFC");
        tcPr.appendChild(shd);
    }

    const tcMar = createWordElement(xmlDoc, "w:tcMar");
    ["top", "bottom", "left", "right"].forEach(side => {
        const margin = createWordElement(xmlDoc, `w:${side}`);
        margin.setAttribute("w:w", "100");
        margin.setAttribute("w:type", "dxa");
        tcMar.appendChild(margin);
    });
    tcPr.appendChild(tcMar);

    cell.appendChild(tcPr);
    cell.appendChild(createTableCellParagraph(xmlDoc, text, colorValue, boldText));
    return cell;
}

function createWordTable(xmlDoc: Document, rows: string[][], colorValue: string): Element {
    const normalizedRows = normalizeTableRows(rows);
    const columnCount = normalizedRows[0]?.length || 1;
    const columnWidth = Math.max(1200, Math.floor(9000 / columnCount));
    const table = createWordElement(xmlDoc, "w:tbl");

    const tblPr = createWordElement(xmlDoc, "w:tblPr");
    const tblW = createWordElement(xmlDoc, "w:tblW");
    tblW.setAttribute("w:w", "0");
    tblW.setAttribute("w:type", "auto");
    tblPr.appendChild(tblW);

    const borders = createWordElement(xmlDoc, "w:tblBorders");
    ["top", "left", "bottom", "right", "insideH", "insideV"].forEach(side => {
        const border = createWordElement(xmlDoc, `w:${side}`);
        border.setAttribute("w:val", "single");
        border.setAttribute("w:sz", "6");
        border.setAttribute("w:space", "0");
        border.setAttribute("w:color", "CBD5E1");
        borders.appendChild(border);
    });
    tblPr.appendChild(borders);
    table.appendChild(tblPr);

    normalizedRows.forEach((row, rowIndex) => {
        const tr = createWordElement(xmlDoc, "w:tr");
        row.forEach(cellText => {
            tr.appendChild(createTableCell(xmlDoc, cellText, colorValue, rowIndex === 0, columnWidth));
        });
        table.appendChild(tr);
    });

    return table;
}

function createStyledBlock(xmlDoc: Document, label: string, text: string, colorValue: string): Element[] {
    const lines = text.split("\n").map(line => cleanInjectedText(line)).filter(Boolean);
    const elements: Element[] = [createStyledParagraph(xmlDoc, label, colorValue, true, "0")];

    for (let i = 0; i < lines.length; i++) {
        if (isPipeTableLine(lines[i])) {
            const tableRows: string[][] = [];
            let cursor = i;

            while (cursor < lines.length && isPipeTableLine(lines[cursor])) {
                if (!isMarkdownTableSeparator(lines[cursor])) {
                    tableRows.push(splitPipeTableRow(lines[cursor]));
                }
                cursor++;
            }

            if (tableRows.length >= 2) {
                elements.push(createWordTable(xmlDoc, tableRows, colorValue));
                i = cursor - 1;
                continue;
            }
        }

        elements.push(createStyledParagraph(xmlDoc, lines[i], colorValue, false, "360"));
    }

    return elements;
}

function insertBlockNearHeading(
    xmlDoc: Document,
    paragraphs: HTMLCollectionOf<Element>,
    headingKeywords: string[],
    label: string,
    text: string,
    colorValue: string
): boolean {
    void paragraphs;
    void headingKeywords;
    return appendBlockToDocumentEnd(xmlDoc, label, text, colorValue);
}

function appendBlockToDocumentEnd(
    xmlDoc: Document,
    label: string,
    text: string,
    colorValue: string
): boolean {
    const body = xmlDoc.getElementsByTagName("w:body")[0];
    if (!body || !text.trim()) return false;
    insertBodyElementsAfter(xmlDoc, null, createStyledBlock(xmlDoc, label, text, colorValue));
    return true;
}

function isGeneratedAssessmentLabel(text: string): boolean {
    const normalized = normalizeVietnamese(text);
    return normalized.includes("goi y danh gia nls/nl ai") ||
        normalized.includes("thiet ke danh gia nls/nl ai");
}

function isGeneratedNonAssessmentLabel(text: string): boolean {
    const normalized = normalizeVietnamese(text);
    return normalized.startsWith("[") &&
        !isGeneratedAssessmentLabel(normalized) &&
        (
            normalized.includes("tich hop ai") ||
            normalized.includes("bo sung sau nang luc") ||
            normalized.includes("muc tieu")
        );
}

function removeTrailingGeneratedAssessmentBlocks(xmlDoc: Document): number {
    const body = xmlDoc.getElementsByTagName("w:body")[0];
    if (!body) return 0;

    const children = Array.from(body.children);
    let lastContentIndex = children.length - 1;
    while (lastContentIndex >= 0 && children[lastContentIndex].tagName === "w:sectPr") {
        lastContentIndex--;
    }

    let startIndex = -1;
    for (let i = lastContentIndex; i >= 0; i--) {
        const text = children[i].textContent || "";
        if (isGeneratedAssessmentLabel(text)) {
            startIndex = i;
            continue;
        }
        if (startIndex >= 0 && isGeneratedNonAssessmentLabel(text)) {
            break;
        }
    }

    if (startIndex < 0) return 0;

    let removed = 0;
    for (let i = startIndex; i <= lastContentIndex; i++) {
        if (children[i]?.parentNode === body) {
            body.removeChild(children[i]);
            removed++;
        }
    }

    return removed;
}

function findParagraphByKeywords(
    paragraphs: HTMLCollectionOf<Element>,
    keywords: string[],
    startIndex = 0,
    endIndex = paragraphs.length
): Element | null {
    const normalizedKeywords = keywords.map(normalizeVietnamese);
    const safeEnd = Math.min(endIndex, paragraphs.length);

    for (let i = Math.max(0, startIndex); i < safeEnd; i++) {
        const paragraphText = normalizeVietnamese(paragraphs[i].textContent || "");
        if (normalizedKeywords.some(keyword => paragraphText.includes(keyword))) {
            return paragraphs[i];
        }
    }

    return null;
}

function findLastParagraphByKeywords(
    paragraphs: HTMLCollectionOf<Element>,
    keywords: string[],
    startIndex = 0,
    endIndex = paragraphs.length
): Element | null {
    const normalizedKeywords = keywords.map(normalizeVietnamese);
    const safeStart = Math.max(0, startIndex);
    const safeEnd = Math.min(endIndex, paragraphs.length);

    for (let i = safeEnd - 1; i >= safeStart; i--) {
        const paragraphText = normalizeVietnamese(paragraphs[i].textContent || "");
        if (normalizedKeywords.some(keyword => paragraphText.includes(keyword))) {
            return paragraphs[i];
        }
    }

    return null;
}

function insertObjectivesInCompetencySection(
    xmlDoc: Document,
    paragraphs: HTMLCollectionOf<Element>,
    headingKeywords: string[],
    label: string,
    text: string,
    colorValue: string
): boolean {
    const body = xmlDoc.getElementsByTagName("w:body")[0];
    if (!body || !text.trim()) return false;

    const objectiveKeywords = headingKeywords.length ? headingKeywords : ["mục tiêu", "muc tieu", "i. mục tiêu", "i mục tiêu"];
    const normalizedObjectiveKeywords = objectiveKeywords.map(normalizeVietnamese);
    const competencyKeywords = [
        "năng lực",
        "nang luc",
        "2. năng lực",
        "2 năng lực",
        "về năng lực",
        "ve nang luc",
        "năng lực chung",
        "năng lực đặc thù",
        "năng lực số",
        "năng lực ai"
    ];
    const requiredCompetencyKeywords = [
        "năng lực chung",
        "nang luc chung",
        "năng lực đặc thù",
        "nang luc dac thu",
        "năng lực môn học",
        "nang luc mon hoc",
        "năng lực đặc thù môn học",
        "nang luc dac thu mon hoc"
    ];
    const qualityKeywords = [
        "phẩm chất",
        "pham chat",
        "về phẩm chất",
        "ve pham chat",
        "3. phẩm chất",
        "3 phẩm chất",
        "6. phẩm chất",
        "6 phẩm chất"
    ];
    const normalizedQualityKeywords = qualityKeywords.map(normalizeVietnamese);
    const nextMajorSectionKeywords = [
        "thiết bị dạy học",
        "thiet bi day hoc",
        "học liệu",
        "hoc lieu",
        "tiến trình dạy học",
        "tien trinh day hoc",
        "ii.",
        "ii "
    ];
    const normalizedNextMajorSectionKeywords = nextMajorSectionKeywords.map(normalizeVietnamese);

    let objectivesIndex = -1;
    let sectionEndIndex = paragraphs.length;
    let qualityIndex = -1;
    for (let i = 0; i < paragraphs.length; i++) {
        const paragraphText = normalizeVietnamese(paragraphs[i].textContent || "");
        if (objectivesIndex < 0 && normalizedObjectiveKeywords.some(keyword => paragraphText.includes(keyword))) {
            objectivesIndex = i;
            continue;
        }
        if (objectivesIndex >= 0 && qualityIndex < 0 && normalizedQualityKeywords.some(keyword => paragraphText.includes(keyword))) {
            qualityIndex = i;
        }
        if (objectivesIndex >= 0 && normalizedNextMajorSectionKeywords.some(keyword => paragraphText.includes(keyword))) {
            sectionEndIndex = i;
            break;
        }
    }

    if (objectivesIndex >= 0) {
        const sectionInsertEnd = qualityIndex >= 0 ? qualityIndex : sectionEndIndex;
        const target = findParagraphByKeywords(paragraphs, requiredCompetencyKeywords, objectivesIndex + 1, sectionInsertEnd) ||
            findParagraphByKeywords(paragraphs, competencyKeywords, objectivesIndex + 1, sectionInsertEnd);
        const beforeTargetIndex = qualityIndex >= 0 ? qualityIndex : (sectionEndIndex < paragraphs.length ? sectionEndIndex : -1);

        if (target && beforeTargetIndex >= 0) {
            const beforeReference = getTopLevelBodyChild(paragraphs[beforeTargetIndex], body);
            return insertBodyElementsBefore(xmlDoc, beforeReference, createStyledBlock(xmlDoc, label, text, colorValue));
        }

        if (target) {
            const afterTarget = findLastParagraphByKeywords(paragraphs, competencyKeywords, objectivesIndex + 1, sectionEndIndex) || target;
            const reference = getTopLevelBodyChild(afterTarget, body);
            return insertBodyElementsAfter(xmlDoc, reference, createStyledBlock(xmlDoc, label, text, colorValue));
        }
    }

    const fallbackTarget =
        findParagraphByKeywords(paragraphs, competencyKeywords) ||
        findParagraphByKeywords(paragraphs, objectiveKeywords);

    const reference = fallbackTarget ? getTopLevelBodyChild(fallbackTarget, body) : null;
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
    const originalStats = await countWordXmlStructures(zip);

    let injectedCount = 0;
    const skippedActivities: string[] = [];
    const previewItems: InjectionResult["previewItems"] = [];

    if (options.objectivesText?.trim()) {
        const found = insertObjectivesInCompetencySection(
            xmlDoc,
            paragraphs,
            ["mục tiêu", "muc tieu", "i. mục tiêu", "i mục tiêu"],
            "[BỔ SUNG SAU NĂNG LỰC CHUNG VÀ NĂNG LỰC ĐẶC THÙ: NLS/NL AI]",
            options.objectivesText,
            "FF0000"
        );
        previewItems.push({
            activityName: "I. MỤC TIÊU / NĂNG LỰC - bổ sung NLS/NL AI sau NL chung và NL đặc thù",
            injectedText: options.objectivesText,
            found
        });
        injectedCount++;
    }

    for (const snippet of snippets) {
        const { paragraph: bestP, score: bestScore } = findBestActivityParagraph(paragraphs, snippet.activityName);

        if (bestP && bestScore >= 40) {
            const body = xmlDoc.getElementsByTagName("w:body")[0];
            const reference = body ? getTopLevelBodyChild(bestP, body) : null;
            insertBodyElementsAfter(
                xmlDoc,
                reference,
                createStyledBlock(xmlDoc, `[TÍCH HỢP AI - QĐ 3439] ${snippet.activityName}`, snippet.text, "FF0000")
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
                    createStyledBlock(xmlDoc, `[TÍCH HỢP AI - ${snippet.activityName}]`, snippet.text, "FF0000")
                );
                injectedCount++;
            }
        }
    }

    if (options.assessmentText?.trim()) {
        removeTrailingGeneratedAssessmentBlocks(xmlDoc);
        const found = appendBlockToDocumentEnd(
            xmlDoc,
            "[GỢI Ý ĐÁNH GIÁ NLS/NL AI - ĐẶT CUỐI GIÁO ÁN]",
            options.assessmentText,
            "FF0000"
        );
        previewItems.push({
            activityName: "CUỐI GIÁO ÁN - GỢI Ý ĐÁNH GIÁ NLS/NL AI",
            injectedText: options.assessmentText,
            found
        });
        injectedCount++;
    }

    const serializer = new XMLSerializer();
    const newXml = serializer.serializeToString(xmlDoc);
    zip.file("word/document.xml", newXml);
    const outputStats = await countWordXmlStructures(zip, { "word/document.xml": newXml });
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

export async function appendAssessmentDesignToDocx(source: Blob | File, assessmentText: string): Promise<{ blob: Blob; preservationReport: PreservationReport }> {
    if (!assessmentText.trim()) {
        throw new Error("Không có nội dung thiết kế đánh giá để chèn vào DOCX.");
    }

    const zip = await JSZip.loadAsync(source);
    const originalPackageParts = getPackageParts(zip);
    const xmlContent = await zip.file("word/document.xml")?.async("string");

    if (!xmlContent) {
        throw new Error("Không tìm thấy word/document.xml trong file DOCX này. File có thể bị hỏng.");
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "application/xml");
    const paragraphs = xmlDoc.getElementsByTagName("w:p");
    const originalStats = await countWordXmlStructures(zip);

    removeTrailingGeneratedAssessmentBlocks(xmlDoc);
    insertBlockNearHeading(
        xmlDoc,
        paragraphs,
        [
            "gợi ý đánh giá nls",
            "goi y danh gia nls",
            "thiết kế đánh giá",
            "thiet ke danh gia",
            "đánh giá nl ai",
            "danh gia nl ai",
            "đánh giá nls",
            "danh gia nls",
            "kiểm tra đánh giá",
            "kiem tra danh gia",
            "đánh giá kết quả học tập",
            "danh gia ket qua hoc tap"
        ],
        "[THIẾT KẾ ĐÁNH GIÁ NLS/NL AI]",
        assessmentText,
        "FF0000"
    );

    const serializer = new XMLSerializer();
    const newXml = serializer.serializeToString(xmlDoc);
    zip.file("word/document.xml", newXml);

    const outputStats = await countWordXmlStructures(zip, { "word/document.xml": newXml });
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
    return { blob, preservationReport };
}
