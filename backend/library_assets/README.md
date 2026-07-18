# Resource Library

Drop content here and it automatically appears in the student Library page —
no code, no database, no restart needed (the page re-scans on every open).

## Folder convention

Organise files by **board → class → subject → chapter**:

```
library_assets/
  CBSE/
    Class 10/
      Mathematics/
        Real Numbers/
          overview.pdf
          notes.html
          practice.mp4
        Polynomials/
          ...
      Science/
        Chemical Reactions and Equations/
          chapter.pdf
  ICSE/
    Class 9/
      Physics/
        ...
  Competitive/
    Class 0/                 # "Class 0" = no specific grade (JEE/NEET/etc.)
      Physics/
        ...
```

## Rules

- **Board** = top-level folder name (CBSE, ICSE, ISC, IB, IGCSE, Competitive…).
- **Class** = second-level folder; the first number is used as the grade
  (`Class 10`, `Class_10`, `Grade 10`, or just `10` all → grade 10).
  Use `Class 0` for competitive/exam content that isn't tied to a grade.
- **Subject** = third-level folder.
- **Chapter** = fourth-level folder.
- **Files** go inside the chapter folder. The filename (without extension) is
  shown as the resource title.

## Supported file types

| Type     | Extensions                 | How it's shown             |
|----------|----------------------------|----------------------------|
| PDF      | `.pdf`                     | rendered in the viewer     |
| Article  | `.html`, `.htm`, `.txt`    | rendered in the viewer     |
| Video    | `.mp4`, `.webm`, `.mov`    | `<video>` player           |
| Image    | `.png`, `.jpg`, `.gif`, …  | `<img>`                    |
| Audio    | `.mp3`, `.wav`             | audio player               |
| Document | `.docx`, `.pptx`, `.xlsx`  | download button            |
| Ebook    | `.epub`                    | download button            |
| Other    | anything else              | download button            |

## Notes

- You can use spaces in folder names — they're fine.
- Files named `README.md` and dotfiles are ignored by the scanner.
- Content here is served via `/api/library/asset` and is **not** committed to
  git (see `.gitignore`). It lives only on the server.
- The default filter (board + grade) for each student is taken from their
  profile; they can browse any other board/grade freely.
