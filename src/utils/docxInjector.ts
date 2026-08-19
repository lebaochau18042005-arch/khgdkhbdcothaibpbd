import JSZip from "jszip";

export interface Snippet {
    activityName: string;
    targetSection?: string;
    targetText?: string;
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

function normalizeForMatch(text: string): string {
    return normalizeVietnamese(text)
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Score how well a paragraph text matches an activity name
function matchScore(paragraphText: string, activityName: string): number {
    const normPara = normalizeForMatch(paragraphText);
    const normActivity = normalizeForMatch(activityName);
    
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

function findPreciseTargetParagraph(
    paragraphs: HTMLCollectionOf<Element>,
    activityParagraph: Element,
    activityName: string,
    targetText?: string,
    targetSection?: string
): { paragraph: Element | null; score: number } {
    const normalizedTarget = normalizeForMatch(targetText || "");
    if (!normalizedTarget) return { paragraph: null, score: 0 };

    const items = Array.from(paragraphs);
    const activityIndex = items.indexOf(activityParagraph);
    if (activityIndex < 0) return { paragraph: null, score: 0 };

    const activityNumber = extractActivityNumber(activityName) || extractActivityNumber(activityParagraph.textContent || "");
    let rangeEnd = items.length;
    for (let i = activityIndex + 1; i < items.length; i++) {
        const candidateText = items[i].textContent || "";
        const candidateNumber = extractActivityNumber(candidateText);
        if (activityNumber && candidateNumber && candidateNumber !== activityNumber) {
            rangeEnd = i;
            break;
        }
        if (!activityNumber && looksLikeActivityHeading(candidateText) && matchScore(candidateText, activityName) < 60) {
            rangeEnd = i;
            break;
        }
    }

    const sectionKeywords = normalizeForMatch(targetSection || "")
        .split(/\s+/)
        .filter(keyword => keyword.length > 2);
    let bestParagraph: Element | null = null;
    let bestScore = 0;
    let sectionFallback: Element | null = null;
    let sectionFallbackScore = 0;

    for (let i = activityIndex; i < rangeEnd; i++) {
        const paragraphText = items[i].textContent || "";
        if (paragraphText.trim().length < 3) continue;
        const normalizedParagraph = normalizeForMatch(paragraphText);

        if (sectionKeywords.length > 0) {
            const matchedSectionKeywords = sectionKeywords.filter(keyword => normalizedParagraph.includes(keyword));
            const sectionRatio = matchedSectionKeywords.length / sectionKeywords.length;
            const sectionScore = normalizedParagraph.includes(normalizeForMatch(targetSection || ""))
                ? 100
                : Math.round(sectionRatio * 60);
            if (sectionScore > sectionFallbackScore) {
                sectionFallbackScore = sectionScore;
                sectionFallback = items[i];
            }
        }

        // Word thường tách một câu qua nhiều w:p hoặc nhiều ô bảng; ghép tối đa 4 đoạn liền nhau để đối chiếu.
        for (let windowSize = 1; windowSize <= 4 && i + windowSize <= rangeEnd; windowSize++) {
            const windowEnd = i + windowSize - 1;
            const combinedText = items
                .slice(i, windowEnd + 1)
                .map(item => item.textContent || "")
                .join(" ");
            const normalizedCombined = normalizeForMatch(combinedText);
            let score = matchScore(combinedText, targetText || "");
            if (normalizedCombined.includes(normalizedTarget)) score += 80;
            if (sectionKeywords.length > 0) {
                const matchedSectionKeywords = sectionKeywords.filter(keyword => normalizedCombined.includes(keyword));
                score += Math.round((matchedSectionKeywords.length / sectionKeywords.length) * 35);
            }
            if (looksLikeActivityHeading(combinedText) && items[windowEnd] !== activityParagraph) score -= 15;
            score -= (windowSize - 1) * 2;
            if (score > bestScore) {
                bestScore = score;
                bestParagraph = items[windowEnd];
            }
        }
    }

    if (bestScore >= 70) return { paragraph: bestParagraph, score: bestScore };
    if (sectionFallback && sectionFallbackScore >= 60) {
        return { paragraph: sectionFallback, score: sectionFallbackScore };
    }
    return { paragraph: null, score: Math.max(bestScore, sectionFallbackScore) };
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

function insertElementsAfterReference(reference: Element, elements: Element[]): boolean {
    const parent = reference.parentNode;
    if (!parent || elements.length === 0) return false;
    const beforeNode = reference.nextSibling;
    for (const element of elements) parent.insertBefore(element, beforeNode);
    return true;
}

function insertElementsBeforeReference(reference: Element, elements: Element[]): boolean {
    const parent = reference.parentNode;
    if (!parent || elements.length === 0) return false;
    for (const element of elements) parent.insertBefore(element, reference);
    return true;
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
    const spacing = xmlDoc.createElementNS(ns, "w:spacing");
    spacing.setAttribute("w:after", "60");
    pPr.appendChild(spacing);
    paragraph.appendChild(pPr);

    const appendRun = (runText: string, isBold: boolean) => {
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
        if (isBold) {
            rPr.appendChild(xmlDoc.createElementNS(ns, "w:b"));
        }

        const sz = xmlDoc.createElementNS(ns, "w:sz");
        sz.setAttribute("w:val", "22");
        rPr.appendChild(sz);
        run.appendChild(rPr);

        const wT = xmlDoc.createElementNS(ns, "w:t");
        wT.textContent = runText;
        wT.setAttribute("xml:space", "preserve");
        run.appendChild(wT);
        paragraph.appendChild(run);
    };

    const cleanedText = cleanInjectedText(text);
    const structuredLine = !boldText
        ? cleanedText.match(/^((?:[a-d]\)|-)\s*[^:]{1,90}:)(.*)$/iu)
        : null;

    if (structuredLine) {
        appendRun(structuredLine[1], true);
        if (structuredLine[2]) appendRun(structuredLine[2], false);
    } else {
        appendRun(cleanedText, boldText);
    }

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

function isRedundantIntegrationBoilerplate(value: string): boolean {
    const normalized = normalizeVietnamese(value || "").replace(/\s+/g, " ").trim();
    return normalized.includes("[nang luc so va nang luc ai]") ||
        normalized.startsWith("bo sung trong muc i. muc tieu - thanh phan nang luc");
}
function enforceBlockRunColor(xmlDoc: Document, elements: Element[], colorValue: string): void {
    for (const element of elements) {
        const runs = Array.from(element.getElementsByTagName("w:r"));
        for (const run of runs) {
            let runProperties = Array.from(run.children).find(child => child.tagName === "w:rPr") as Element | undefined;
            if (!runProperties) {
                runProperties = createWordElement(xmlDoc, "w:rPr");
                run.insertBefore(runProperties, run.firstChild);
            }

            let color = Array.from(runProperties.children).find(child => child.tagName === "w:color") as Element | undefined;
            if (!color) {
                color = createWordElement(xmlDoc, "w:color");
                runProperties.appendChild(color);
            }
            color.setAttribute("w:val", colorValue);
        }
    }
}


function createStyledBlock(xmlDoc: Document, label: string, text: string, colorValue: string): Element[] {
    const lines = text.split("\n")
        .map(line => cleanInjectedText(line))
        .filter(line => Boolean(line) && !isRedundantIntegrationBoilerplate(line));
    const cleanLabel = cleanInjectedText(label);
    const elements: Element[] = cleanLabel && !isRedundantIntegrationBoilerplate(cleanLabel)
        ? [createStyledParagraph(xmlDoc, cleanLabel, colorValue, true, "0")]
        : [];

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

    enforceBlockRunColor(xmlDoc, elements, colorValue);
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
    const body = xmlDoc.getElementsByTagName("w:body")[0];
    if (!body || !text.trim()) return false;
    const heading = findParagraphByKeywords(paragraphs, headingKeywords);
    if (!heading) return appendBlockToDocumentEnd(xmlDoc, label, text, colorValue);
    return insertElementsAfterReference(heading, createStyledBlock(xmlDoc, label, text, colorValue));
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
            return insertElementsBeforeReference(paragraphs[beforeTargetIndex], createStyledBlock(xmlDoc, label, text, colorValue));
        }

        if (target) {
            const afterTarget = findLastParagraphByKeywords(paragraphs, competencyKeywords, objectivesIndex + 1, sectionEndIndex) || target;
            return insertElementsAfterReference(afterTarget, createStyledBlock(xmlDoc, label, text, colorValue));
        }
    }

    const fallbackTarget =
        findParagraphByKeywords(paragraphs, competencyKeywords) ||
        findParagraphByKeywords(paragraphs, objectiveKeywords);

    if (!fallbackTarget) return false;
    return insertElementsAfterReference(fallbackTarget, createStyledBlock(xmlDoc, label, text, colorValue));
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
            "",
            options.objectivesText,
            "FF0000"
        );
        previewItems.push({
            activityName: "I. MỤC TIÊU / NĂNG LỰC - bổ sung NLS/NL AI sau NL chung và NL đặc thù",
            injectedText: options.objectivesText,
            found
        });
        if (found) injectedCount++;
    }

    for (const snippet of snippets) {
        const { paragraph: activityParagraph, score: activityScore } = findBestActivityParagraph(paragraphs, snippet.activityName);
        const preciseTarget = activityParagraph && activityScore >= 80
            ? findPreciseTargetParagraph(
                paragraphs,
                activityParagraph,
                snippet.activityName,
                snippet.targetText,
                snippet.targetSection
            )
            : { paragraph: null, score: 0 };

        if (activityParagraph && activityScore >= 80 && preciseTarget.paragraph) {
            const inserted = insertElementsAfterReference(
                preciseTarget.paragraph,
                createStyledBlock(xmlDoc, "[TÍCH HỢP NLS/NL AI]", snippet.text, "FF0000")
            );
            if (!inserted) {
                skippedActivities.push(snippet.activityName);
                previewItems.push({ activityName: snippet.activityName, injectedText: snippet.text, found: false });
                continue;
            }
            
            injectedCount++;
            previewItems.push({
                activityName: snippet.activityName,
                injectedText: snippet.text,
                found: true
            });
        } else {
            // Nội dung tích hợp chỉ được chèn khi tìm đúng hoạt động trong giáo án.
            skippedActivities.push(snippet.activityName);
            previewItems.push({
                activityName: snippet.activityName,
                injectedText: snippet.text,
                found: false
            });
        }
    }

    if (options.assessmentText?.trim()) {
        removeTrailingGeneratedAssessmentBlocks(xmlDoc);
        const found = insertBlockNearHeading(
            xmlDoc,
            paragraphs,
            ["iv. kế hoạch đánh giá", "kế hoạch đánh giá", "kiểm tra đánh giá", "đánh giá kết quả học tập"],
            "[GỢI Ý ĐÁNH GIÁ NLS/NL AI]",
            options.assessmentText,
            "FF0000"
        );
        previewItems.push({
            activityName: "IV. KẾ HOẠCH ĐÁNH GIÁ / vị trí cuối nếu giáo án không có mục đánh giá",
            injectedText: options.assessmentText,
            found
        });
        if (found) injectedCount++;
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
