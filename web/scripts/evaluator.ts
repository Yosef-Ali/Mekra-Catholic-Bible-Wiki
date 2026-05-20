import fs from 'fs';

interface Verse {
    verse_number: number;
    text: string;
}

interface Chapter {
    book: string;
    chapter: number;
    verses: Verse[];
}

export function calculateMetrics(pred: Chapter, gold: Chapter) {
    const goldVerses = new Map(gold.verses.map(v => [v.verse_number, v.text]));
    const predVerses = new Map(pred.verses.map(v => [v.verse_number, v.text]));

    if (goldVerses.size === 0 || predVerses.size === 0) {
        return { recall: 0, precision: 0, exactMatchRate: 0, avgCharDiff: 0 };
    }

    let found = 0;
    let exactMatch = 0;
    let charDistance = 0;

    for (const [num, goldText] of goldVerses) {
        if (predVerses.has(num)) {
            found++;
            const predText = predVerses.get(num)!;
            if (predText.trim() === goldText.trim()) {
                exactMatch++;
            }
            charDistance += Math.abs(predText.length - goldText.length);
        }
    }

    return {
        recall: found / goldVerses.size,
        precision: found / predVerses.size,
        exactMatchRate: exactMatch / goldVerses.size,
        avgCharDiff: charDistance / goldVerses.size
    };
}

if (process.argv[1].endsWith('evaluator.ts')) {
    const [,, goldPath, predPath] = process.argv;
    if (!goldPath || !predPath) {
        console.log('Usage: npx tsx evaluator.ts <gold.json> <pred.json>');
        process.exit(1);
    }

    const gold = JSON.parse(fs.readFileSync(goldPath, 'utf-8'));
    const pred = JSON.parse(fs.readFileSync(predPath, 'utf-8'));

    console.log('\n📊 Evaluation Metrics:');
    console.log(JSON.stringify(calculateMetrics(pred, gold), null, 2));
}
