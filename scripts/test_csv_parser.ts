import { parseCsvLines } from './fix_to_csv';

const testData = `Chapter,Verse,Text
1,1,In the beginning.
1,2,"God created the heavens, and the earth."
1,3,"Quoted ""word"" inside."
1,4,Simple text
2,1,Chapter two starts here.
invalid line that should be skipped
1, 5, "Spacing support check"
`;

console.log('Running CSV Parser Test...');

const result = parseCsvLines(testData);

let passed = true;

// Test Chapter 1
if (!result.has(1)) {
  console.error('❌ Missing Chapter 1');
  passed = false;
} else {
  const ch1 = result.get(1);
  if (ch1.length !== 5) {
    console.error(`❌ Chapter 1 verse count mismatch. Expected 5, got ${ch1.length}`);
    passed = false;
  }

  // Check verses
  if (ch1[0].text !== 'In the beginning.') console.error('❌ Verse 1.1 mismatch'), passed = false;
  if (ch1[1].text !== 'God created the heavens, and the earth.') console.error('❌ Verse 1.2 mismatch (comma inside quotes)'), passed = false;
  if (ch1[2].text !== 'Quoted "word" inside.') console.error('❌ Verse 1.3 mismatch (escaped quotes)'), passed = false;
  if (ch1[3].text !== 'Simple text') console.error('❌ Verse 1.4 mismatch'), passed = false;
  if (ch1[4].text !== 'Spacing support check') console.error('❌ Verse 1.5 mismatch (spacing)'), passed = false;
}

// Test Chapter 2
if (!result.has(2)) {
  console.error('❌ Missing Chapter 2');
  passed = false;
}

if (passed) {
  console.log('✅ All tests passed!');
} else {
  console.error('❌ Some tests failed.');
  process.exit(1);
}
