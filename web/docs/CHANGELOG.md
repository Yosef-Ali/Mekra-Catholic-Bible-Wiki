# Changelog

All notable changes to Fana Catholic Bible will be documented in this file.

## [0.1.0.0] - 2026-04-03

### Added
- Data pipeline: 18 scripts for PDF extraction, validation, quality checking, and database seeding
- Test infrastructure: vitest with @testing-library/react and initial test suite
- npm scripts for agent extraction, quality loop, and paragraph generation

### Changed
- BibleReader verse highlighting now uses O(1) Map lookup instead of O(n) findIndex per render
- Gemini format analyzer upgraded from gemini-3-pro-preview to gemini-3-flash-preview
- Format analyzer now auto-derives paragraphBreaks from section boundaries and persists formatting metadata

### Fixed
- N+1 query in subtitle extraction replaced with single JOIN query
- Typo in slow-extract.ts that broke the function call
