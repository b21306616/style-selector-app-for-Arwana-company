# Arwana sample interior images

Generated for the offline sample catalog on 2026-11-17 using the built-in `image_gen` tool. No CLI/API fallback or stock-photo provider was used. These are AI-generated illustrative interiors, not photographs of completed Arwana projects.

## Delivered assets

- 48 distinct full images: four rooms × four styles × three variations.
- 48 matching thumbnails.
- Full images: 1536 × 1024 JPEG, 13,947,708 bytes in total.
- Thumbnails: 320 × 213 JPEG, 824,754 bytes in total.
- Application manifest: `src/data/bundled-images.ts` exports `bundledImages` and `bundledThumbnails` with static Metro references.
- Image files: `assets/photos/{room}-{style}-{variation}.jpg`.
- Thumbnail files: `assets/photos/{room}-{style}-{variation}-thumb.jpg`.
- Review sheets: `assets/photos/review/`. These are inspection artifacts and are not imported by the application.

Room IDs: `bathroom`, `bedroom`, `living_room`, `kitchen`. Style IDs: `scandinavian`, `minimalist`, `modern_classic`, `industrial`.

## Preparation and review

Each asset was generated separately. The original PNG was retained in the image tool's default generated-images directory. The project JPEG and thumbnail were produced with Windows System.Drawing, high-quality bicubic resizing, and JPEG quality 84. No compositing, generative edits, or intentional cropping were applied to the project photos.

All four room contact sheets were visually inspected. Rooms and styles are recognizable and consistent across variants; no people, text overlays, logos, watermarks, or conspicuous geometry failures were observed at review resolution. All 48 full JPEGs have unique SHA-256 hashes. These samples are for demonstrating the app and its tagging workflow; staff can replace them with the company's own curated catalog.

The filenames below identify the original generator outputs for provenance. They are not runtime dependencies.

## Exact generation prompts

### bathroom-industrial-1

Original generator output: `exec-6f568d94-ea76-434d-962c-927a2e9b2883.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bathroom with a vanity basin, mirror, toilet, and shower or freestanding bathtub. Industrial design: earthy palette, exposed brick and concrete, dark metal elements, functional loft furniture, prominent statement metal lighting. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bathroom and industrial style.

### bathroom-industrial-2

Original generator output: `exec-88c9b090-7c5b-4eb5-b71e-0d4f510845d8.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bathroom with a vanity basin, mirror, toilet, and shower or freestanding bathtub. Industrial design: earthy palette, exposed brick and concrete, dark metal elements, functional loft furniture, prominent statement metal lighting. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bathroom and industrial style.

### bathroom-industrial-3

Original generator output: `exec-87e577d7-f157-407d-a2c3-c590e2083bee.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bathroom with a vanity basin, mirror, toilet, and shower or freestanding bathtub. Industrial design: earthy palette, exposed brick and concrete, dark metal elements, functional loft furniture, prominent statement metal lighting. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bathroom and industrial style.

### bathroom-minimalist-1

Original generator output: `exec-5840d9b3-9725-4935-be7a-4d6548322a30.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bathroom with a vanity basin, mirror, toilet, and shower or freestanding bathtub. Minimalist design: cool neutral white and light grey palette, natural stone surfaces, exceptionally clean simple lines, restrained furniture, concealed storage, uncluttered architectural space. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bathroom and minimalist style.

### bathroom-minimalist-2

Original generator output: `exec-ef7b2839-4dc6-48c0-b5a5-207f2241e433.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bathroom with a vanity basin, mirror, toilet, and shower or freestanding bathtub. Minimalist design: cool neutral white and light grey palette, natural stone surfaces, exceptionally clean simple lines, restrained furniture, concealed storage, uncluttered architectural space. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bathroom and minimalist style.

### bathroom-minimalist-3

Original generator output: `exec-102a8edd-039b-4eba-852f-1cc4deb22711.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bathroom with a vanity basin, mirror, toilet, and shower or freestanding bathtub. Minimalist design: cool neutral white and light grey palette, natural stone surfaces, exceptionally clean simple lines, restrained furniture, concealed storage, uncluttered architectural space. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bathroom and minimalist style.

### bathroom-modern_classic-1

Original generator output: `exec-02329b9f-9b63-4afe-9bdd-11b77cc4d9aa.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bathroom with a vanity basin, mirror, toilet, and shower or freestanding bathtub. Modern Classic design: warm neutral ivory and taupe palette, elegant natural stone surfaces, refined wall mouldings, contemporary interpretations of classic furniture, sculptural statement lighting. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bathroom and modern classic style.

### bathroom-modern_classic-2

Original generator output: `exec-20b39fed-f950-4d10-bd57-ea020d055352.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bathroom with a vanity basin, mirror, toilet, and shower or freestanding bathtub. Modern Classic design: warm neutral ivory and taupe palette, elegant natural stone surfaces, refined wall mouldings, contemporary interpretations of classic furniture, sculptural statement lighting. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bathroom and modern classic style.

### bathroom-modern_classic-3

Original generator output: `exec-f71c08e7-218f-448c-bfd5-cbd71078a386.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bathroom with a vanity basin, mirror, toilet, and shower or freestanding bathtub. Modern Classic design: warm neutral ivory and taupe palette, elegant natural stone surfaces, refined wall mouldings, contemporary interpretations of classic furniture, sculptural statement lighting. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bathroom and modern classic style.

### bathroom-scandinavian-1

Original generator output: `exec-3b4f1dc6-93f7-4e80-a5ec-c3d92b0682f2.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample photo. Create one professional editorial architectural photograph of a Scandinavian bathroom. Warm neutral ivory walls and tiles, pale oak floating vanity, simple chrome fittings, clean lines, folded soft linen towels, wide mirror, walk-in shower. A coherent attractive room in believable proportions, soft natural daylight through a tall frosted side window, realistic tactile materials. Landscape 1536x1024, wide eye-level 28mm architectural lens, straight verticals, show the whole bathroom with all important furniture comfortably inside the frame. No people, no text, no logos, no watermarks, no collage. Variant 1: compact serene city-apartment bathroom.

### bathroom-scandinavian-2

Original generator output: `exec-f600ed5f-b7d4-4f12-a864-a4fcc5298a3c.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bathroom with a vanity basin, mirror, toilet, and shower or freestanding bathtub. Scandinavian design: warm neutral cream palette, pale natural oak wood, clean restrained lines, soft linen textiles, warm unpretentious atmosphere. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bathroom and scandinavian style.

### bathroom-scandinavian-3

Original generator output: `exec-4bbe1305-77ea-440a-90ec-17608e98ab81.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bathroom with a vanity basin, mirror, toilet, and shower or freestanding bathtub. Scandinavian design: warm neutral cream palette, pale natural oak wood, clean restrained lines, soft linen textiles, warm unpretentious atmosphere. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bathroom and scandinavian style.

### bedroom-industrial-1

Original generator output: `exec-3e56bae2-067e-45f6-b4a4-74654b617cab.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bedroom with a double bed, bedside tables, storage, and a window. Industrial design: earthy palette, exposed brick and concrete, dark metal elements, functional loft furniture, prominent statement metal lighting. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bedroom and industrial style.

### bedroom-industrial-2

Original generator output: `exec-b7365536-a45f-4b2b-a1a0-79627e4e64b3.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bedroom with a double bed, bedside tables, storage, and a window. Industrial design: earthy palette, exposed brick and concrete, dark metal elements, functional loft furniture, prominent statement metal lighting. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bedroom and industrial style.

### bedroom-industrial-3

Original generator output: `exec-9167272e-2408-4cd7-a074-d2e303b3f870.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bedroom with a double bed, bedside tables, storage, and a window. Industrial design: earthy palette, exposed brick and concrete, dark metal elements, functional loft furniture, prominent statement metal lighting. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bedroom and industrial style.

### bedroom-minimalist-1

Original generator output: `exec-4d025b64-fc3f-400e-9804-aed62e06868e.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bedroom with a double bed, bedside tables, storage, and a window. Minimalist design: cool neutral white and light grey palette, natural stone surfaces, exceptionally clean simple lines, restrained furniture, concealed storage, uncluttered architectural space. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bedroom and minimalist style.

### bedroom-minimalist-2

Original generator output: `exec-0e515732-1217-4519-a4f8-9dccb9377e12.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bedroom with a double bed, bedside tables, storage, and a window. Minimalist design: cool neutral white and light grey palette, natural stone surfaces, exceptionally clean simple lines, restrained furniture, concealed storage, uncluttered architectural space. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bedroom and minimalist style.

### bedroom-minimalist-3

Original generator output: `exec-54b3dcf8-462a-4084-8a5e-54dfbfd4d739.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bedroom with a double bed, bedside tables, storage, and a window. Minimalist design: cool neutral white and light grey palette, natural stone surfaces, exceptionally clean simple lines, restrained furniture, concealed storage, uncluttered architectural space. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bedroom and minimalist style.

### bedroom-modern_classic-1

Original generator output: `exec-1f6f4956-febb-4bd0-9cdb-b325075a62b4.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bedroom with a double bed, bedside tables, storage, and a window. Modern Classic design: warm neutral ivory and taupe palette, elegant natural stone surfaces, refined wall mouldings, contemporary interpretations of classic furniture, sculptural statement lighting. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bedroom and modern classic style.

### bedroom-modern_classic-2

Original generator output: `exec-4d15881c-0f3e-4756-859b-16b5d8c2e30c.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bedroom with a double bed, bedside tables, storage, and a window. Modern Classic design: warm neutral ivory and taupe palette, elegant natural stone surfaces, refined wall mouldings, contemporary interpretations of classic furniture, sculptural statement lighting. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bedroom and modern classic style.

### bedroom-modern_classic-3

Original generator output: `exec-e6822919-5e5f-4585-bd16-59ba146c9f52.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bedroom with a double bed, bedside tables, storage, and a window. Modern Classic design: warm neutral ivory and taupe palette, elegant natural stone surfaces, refined wall mouldings, contemporary interpretations of classic furniture, sculptural statement lighting. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bedroom and modern classic style.

### bedroom-scandinavian-1

Original generator output: `exec-93017bd2-029a-4369-94cf-f208bacbc81a.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bedroom with a double bed, bedside tables, storage, and a window. Scandinavian design: warm neutral cream palette, pale natural oak wood, clean restrained lines, soft linen textiles, warm unpretentious atmosphere. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bedroom and scandinavian style.

### bedroom-scandinavian-2

Original generator output: `exec-085f2139-c9ab-43a1-b1bc-2cf367fdeff6.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bedroom with a double bed, bedside tables, storage, and a window. Scandinavian design: warm neutral cream palette, pale natural oak wood, clean restrained lines, soft linen textiles, warm unpretentious atmosphere. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bedroom and scandinavian style.

### bedroom-scandinavian-3

Original generator output: `exec-4fccd88c-339c-441e-90ed-c17716071fa4.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a bedroom with a double bed, bedside tables, storage, and a window. Scandinavian design: warm neutral cream palette, pale natural oak wood, clean restrained lines, soft linen textiles, warm unpretentious atmosphere. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable bedroom and scandinavian style.

### kitchen-industrial-1

Original generator output: `exec-0ca7199f-2710-45b2-a480-481586a5ec14.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a kitchen with fitted cabinetry, worktops, sink, cooking area, and dining or island seating. Industrial design: earthy palette, exposed brick and concrete, dark metal elements, functional loft furniture, prominent statement metal lighting. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable kitchen and industrial style.

### kitchen-industrial-2

Original generator output: `exec-b1b4b9a5-21ba-4538-8db2-1f3f07396598.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a kitchen with fitted cabinetry, worktops, sink, cooking area, and dining or island seating. Industrial design: earthy palette, exposed brick and concrete, dark metal elements, functional loft furniture, prominent statement metal lighting. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable kitchen and industrial style.

### kitchen-industrial-3

Original generator output: `exec-ad810743-66b7-4d7b-af3d-5addfa765d69.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a kitchen with fitted cabinetry, worktops, sink, cooking area, and dining or island seating. Industrial design: earthy palette, exposed brick and concrete, dark metal elements, functional loft furniture, prominent statement metal lighting. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable kitchen and industrial style.

### kitchen-minimalist-1

Original generator output: `exec-2d798513-f983-4b15-af27-fa21bdfe7eb3.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a kitchen with fitted cabinetry, worktops, sink, cooking area, and dining or island seating. Minimalist design: cool neutral white and light grey palette, natural stone surfaces, exceptionally clean simple lines, restrained furniture, concealed storage, uncluttered architectural space. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable kitchen and minimalist style.

### kitchen-minimalist-2

Original generator output: `exec-948bb552-25b1-4b4e-bdea-15c314a21286.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a kitchen with fitted cabinetry, worktops, sink, cooking area, and dining or island seating. Minimalist design: cool neutral white and light grey palette, natural stone surfaces, exceptionally clean simple lines, restrained furniture, concealed storage, uncluttered architectural space. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable kitchen and minimalist style.

### kitchen-minimalist-3

Original generator output: `exec-94dfb726-a6cc-48e5-9e32-2830e03b66a6.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a kitchen with fitted cabinetry, worktops, sink, cooking area, and dining or island seating. Minimalist design: cool neutral white and light grey palette, natural stone surfaces, exceptionally clean simple lines, restrained furniture, concealed storage, uncluttered architectural space. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable kitchen and minimalist style.

### kitchen-modern_classic-1

Original generator output: `exec-056ec94e-2c35-4226-a660-7a3f4b336635.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a kitchen with fitted cabinetry, worktops, sink, cooking area, and dining or island seating. Modern Classic design: warm neutral ivory and taupe palette, elegant natural stone surfaces, refined wall mouldings, contemporary interpretations of classic furniture, sculptural statement lighting. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable kitchen and modern classic style.

### kitchen-modern_classic-2

Original generator output: `exec-f28f7039-6f5d-48d7-8dbd-0ce757c50241.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a kitchen with fitted cabinetry, worktops, sink, cooking area, and dining or island seating. Modern Classic design: warm neutral ivory and taupe palette, elegant natural stone surfaces, refined wall mouldings, contemporary interpretations of classic furniture, sculptural statement lighting. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable kitchen and modern classic style.

### kitchen-modern_classic-3

Original generator output: `exec-9faf201a-c5dc-45c3-90e4-aa8350294438.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a kitchen with fitted cabinetry, worktops, sink, cooking area, and dining or island seating. Modern Classic design: warm neutral ivory and taupe palette, elegant natural stone surfaces, refined wall mouldings, contemporary interpretations of classic furniture, sculptural statement lighting. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable kitchen and modern classic style.

### kitchen-scandinavian-1

Original generator output: `exec-748d54f4-c7e9-4b93-b78c-2effeb50c43d.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a kitchen with fitted cabinetry, worktops, sink, cooking area, and dining or island seating. Scandinavian design: warm neutral cream palette, pale natural oak wood, clean restrained lines, soft linen textiles, warm unpretentious atmosphere. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable kitchen and scandinavian style.

### kitchen-scandinavian-2

Original generator output: `exec-18d68840-e402-4de4-a570-85c2ca673b93.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a kitchen with fitted cabinetry, worktops, sink, cooking area, and dining or island seating. Scandinavian design: warm neutral cream palette, pale natural oak wood, clean restrained lines, soft linen textiles, warm unpretentious atmosphere. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable kitchen and scandinavian style.

### kitchen-scandinavian-3

Original generator output: `exec-c7605396-9b55-43bb-8a6a-2ec92b90a5e4.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a kitchen with fitted cabinetry, worktops, sink, cooking area, and dining or island seating. Scandinavian design: warm neutral cream palette, pale natural oak wood, clean restrained lines, soft linen textiles, warm unpretentious atmosphere. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable kitchen and scandinavian style.

### living_room-industrial-1

Original generator output: `exec-a8db9af6-48d4-444d-adad-e3c6aaf2df9e.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a living room with a sofa, lounge chair, coffee table, storage, and windows. Industrial design: earthy palette, exposed brick and concrete, dark metal elements, functional loft furniture, prominent statement metal lighting. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable living room and industrial style.

### living_room-industrial-2

Original generator output: `exec-343326e5-1024-46ba-95b3-1556efe2c028.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a living room with a sofa, lounge chair, coffee table, storage, and windows. Industrial design: earthy palette, exposed brick and concrete, dark metal elements, functional loft furniture, prominent statement metal lighting. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable living room and industrial style.

### living_room-industrial-3

Original generator output: `exec-e7d12cba-cb90-4012-89c8-595b72252ce1.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a living room with a sofa, lounge chair, coffee table, storage, and windows. Industrial design: earthy palette, exposed brick and concrete, dark metal elements, functional loft furniture, prominent statement metal lighting. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable living room and industrial style.

### living_room-minimalist-1

Original generator output: `exec-e7f42427-69ee-4424-bec2-6c08d8d4f875.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a living room with a sofa, lounge chair, coffee table, storage, and windows. Minimalist design: cool neutral white and light grey palette, natural stone surfaces, exceptionally clean simple lines, restrained furniture, concealed storage, uncluttered architectural space. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable living room and minimalist style.

### living_room-minimalist-2

Original generator output: `exec-ed36d444-593c-4431-b10c-0d231b8d0928.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a living room with a sofa, lounge chair, coffee table, storage, and windows. Minimalist design: cool neutral white and light grey palette, natural stone surfaces, exceptionally clean simple lines, restrained furniture, concealed storage, uncluttered architectural space. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable living room and minimalist style.

### living_room-minimalist-3

Original generator output: `exec-a22b244a-dbb1-424f-8554-b777d0ad73c6.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a living room with a sofa, lounge chair, coffee table, storage, and windows. Minimalist design: cool neutral white and light grey palette, natural stone surfaces, exceptionally clean simple lines, restrained furniture, concealed storage, uncluttered architectural space. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable living room and minimalist style.

### living_room-modern_classic-1

Original generator output: `exec-2e334101-cad2-4018-bff6-bee02dd24c36.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a living room with a sofa, lounge chair, coffee table, storage, and windows. Modern Classic design: warm neutral ivory and taupe palette, elegant natural stone surfaces, refined wall mouldings, contemporary interpretations of classic furniture, sculptural statement lighting. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable living room and modern classic style.

### living_room-modern_classic-2

Original generator output: `exec-ded6d62c-e0eb-4efe-9793-d0b327849400.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a living room with a sofa, lounge chair, coffee table, storage, and windows. Modern Classic design: warm neutral ivory and taupe palette, elegant natural stone surfaces, refined wall mouldings, contemporary interpretations of classic furniture, sculptural statement lighting. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable living room and modern classic style.

### living_room-modern_classic-3

Original generator output: `exec-7922c7e7-8eab-48a9-8957-0a0f3bdb912d.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a living room with a sofa, lounge chair, coffee table, storage, and windows. Modern Classic design: warm neutral ivory and taupe palette, elegant natural stone surfaces, refined wall mouldings, contemporary interpretations of classic furniture, sculptural statement lighting. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable living room and modern classic style.

### living_room-scandinavian-1

Original generator output: `exec-aaea0493-f78b-43c2-94d6-6f30e126a5ee.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a living room with a sofa, lounge chair, coffee table, storage, and windows. Scandinavian design: warm neutral cream palette, pale natural oak wood, clean restrained lines, soft linen textiles, warm unpretentious atmosphere. Setting and variation: a compact urban apartment, bright soft morning daylight, three-quarter eye-level view showing the room's complete layout. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable living room and scandinavian style.

### living_room-scandinavian-2

Original generator output: `exec-ee625d8a-0acd-47c5-a70d-ef3aa626cd30.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a living room with a sofa, lounge chair, coffee table, storage, and windows. Scandinavian design: warm neutral cream palette, pale natural oak wood, clean restrained lines, soft linen textiles, warm unpretentious atmosphere. Setting and variation: a spacious suburban home, warm late-afternoon daylight, wide frontal architectural composition, a distinct furniture arrangement and different window placement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable living room and scandinavian style.

### living_room-scandinavian-3

Original generator output: `exec-bfe6ffef-ef2c-4730-98f8-330da702969c.png`.

> Use case: photorealistic-natural. Asset type: offline interior style selector sample. Generate one professional editorial architectural photograph of a living room with a sofa, lounge chair, coffee table, storage, and windows. Scandinavian design: warm neutral cream palette, pale natural oak wood, clean restrained lines, soft linen textiles, warm unpretentious atmosphere. Setting and variation: an architect-designed loft or townhouse, overcast diffused daylight, wide diagonal view from the doorway, original room geometry and a different furniture arrangement. Believable physical geometry and materials, realistic construction, refined attractive interior suitable for a premium interior design showroom. Landscape 1536x1024, 28mm architectural lens, straight verticals, generous wide framing with the primary furniture fully visible. No people, no text, no labels, no logos, no watermarks, no collage. Clearly recognizable living room and scandinavian style.
