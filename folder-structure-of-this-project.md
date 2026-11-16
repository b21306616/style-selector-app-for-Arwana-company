# Folder structure of this project

```text
arwana-style-selector/
├── assets/
│   └── photos/                  # Bundled offline WebP/JPG interior photos
│       ├── bathroom/            # 50 photos
│       ├── bedroom/             # 50 photos
│       ├── living_room/         # 50 photos
│       └── kitchen/             # 50 photos
├── data/
│   ├── catalog.ts               # Offline photo metadata + tag definitions
│   └── i18n.ts                  # English & Russian translations
└── src/
    └── app/
        ├── _layout.tsx          # Root navigation wrapper + GestureHandlerRootView
        ├── index.tsx            # Screen 1: Choose a space (Whole House + 4 rooms)
        ├── gallery.tsx          # Screen 2: Swipe right (like) / left (dislike)
        └── result.tsx           # Screen 3: Style summary based on common tags
```
