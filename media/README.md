# Project photos

Drop images here and reference them from `projects.json` as `/media/<name>.jpg`.

Two places take an image:

```jsonc
// A single photo attached to one step of the prototyping process
"process": [
  {
    "phase": "02",
    "image": {
      "src": "/media/v2-cracked-housing.jpg",
      "alt": "Cracked print housing, viewed from the side",
      "caption": "Version 2 after four days in a work truck."
    }
  }
]

// The gallery at the bottom of a project page
"gallery": [
  { "src": "/media/bench-01.jpg", "alt": "...", "caption": "..." }
]
```

Set `"image": null` and leave `"gallery": []` when you have no photo. The pages
render fine without them — nothing looks broken or half-empty.

## Practical notes

- **`alt` is not optional.** Describe what's in the frame. It's what a screen
  reader announces and what shows if the file ever fails to load.
- **Resize before committing.** Anything wider than about 1600px is wasted on a
  web page and just makes the repo heavy. Git stores every version of a binary
  forever, so a habit of committing 8MB phone photos gets expensive to undo.
- **JPEG for photos, PNG for screenshots, SVG for diagrams.**
- Phone photos of a real prototype on a real bench beat staged product shots
  here. The point of these pages is the process, not the marketing.
