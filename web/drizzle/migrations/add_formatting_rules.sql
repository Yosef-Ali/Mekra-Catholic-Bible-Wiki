-- Add formatting_rules column to store formatting metadata
ALTER TABLE formatted_chapter_contents
ADD COLUMN IF NOT EXISTS formatting_rules JSONB;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_chapter_formatting
ON formatted_chapter_contents(book_id, chapter_number);

-- Update style column to allow 'mixed' value
ALTER TABLE formatted_chapter_contents
ALTER COLUMN style SET DEFAULT 'prose';

COMMENT ON COLUMN formatted_chapter_contents.formatting_rules IS
'Stores exact verse ranges for different formatting types (poetry, lists, footnotes).
Example: {"sections":[{"type":"poetry","verseRange":[14,19],"indent":1}],"hasPoetry":true}';
