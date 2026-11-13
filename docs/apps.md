# Use step-narrator in your site or app

Two ways work everywhere:

1. **Attributes.** Put `data-step-narrator` on your Listen button and `data-narrate` on each step's title. Call `StepNarrator.watch()` once. It reads each step when it appears, and again when its words change.
2. **Code.** Call `StepNarrator.bind(button)` once, then `StepNarrator.say(text)` each time the step changes.

The attribute way is the easiest in apps, because your framework already draws the steps.

## Install in an app

```
npm install github:k3nnyw0lf/step-narrator#v1.3.0
```

```js
import StepNarrator from 'step-narrator';
```

TypeScript types are included. If TypeScript complains about the default import, turn on `esModuleInterop` in `tsconfig.json`.

On the server (server-side rendering) there is no browser, so step-narrator does nothing there. It is safe to import anywhere.

## React

Call `watch()` once, for example in `main.jsx`:

```jsx
import StepNarrator from 'step-narrator';
StepNarrator.watch();
```

Then use the attributes in any component:

```jsx
function Step({ number, title, hint }) {
  return (
    <div data-narrate>
      <p>Step {number} of 3</p>
      <h2>{title}</h2>
      <p>{hint}</p>
    </div>
  );
}

function ListenButton() {
  return <button type="button" data-step-narrator hidden>Listen</button>;
}
```

Prefer code? Bind the button and read the step when it changes:

```jsx
import { useEffect, useRef } from 'react';
import StepNarrator from 'step-narrator';

function ListenButton() {
  const ref = useRef(null);
  useEffect(() => {
    const button = ref.current;
    StepNarrator.bind(button);
    return () => StepNarrator.unbind(button);
  }, []);
  return <button ref={ref} type="button" hidden>Listen</button>;
}

// In your form component:
useEffect(() => {
  StepNarrator.say(`Step ${step} of 3. ${titles[step]}`);
}, [step]);
```

## Next.js

Same as React. Put the code in a client component (`'use client'`). Importing it in server code is safe: it does nothing there.

## Vue

```vue
<script setup>
import { onMounted } from 'vue';
import StepNarrator from 'step-narrator';
onMounted(() => StepNarrator.watch());
</script>

<template>
  <button type="button" data-step-narrator hidden>Listen</button>
  <div data-narrate>
    <p>Step {{ step }} of 3</p>
    <h2>{{ title }}</h2>
  </div>
</template>
```

## Svelte, Angular and others

Import it and call `StepNarrator.watch()` once your app is on the page. Then use the attributes in your templates. Or use `bind()` and `say()` like the React code example.

## Site builders and plain HTML

Upload `step-narrator.js` to your site, then add before `</body>`:

```html
<script src="/step-narrator.js"></script>
```

Add the attributes to your elements. If a page loads its steps later, add `data-watch` to the script tag.

- **WordPress:** add the script with a Custom HTML block or your theme's footer. Use "Edit as HTML" on a block to add `data-narrate`.
- **Shopify:** upload the file to your theme's Assets, then add `<script src="{{ 'step-narrator.js' | asset_url }}" defer></script>` before `</body>` in `theme.liquid`.
- **Webflow:** add the script in Custom code, before the `</body>` tag. Add `data-narrate` in an element's Custom attributes.
- **Any other builder:** if it lets you add your own code and your own attributes, it works the same way.

## One page, many languages

Each element is read in the language of its closest `lang` attribute:

```html
<html lang="en">
  ...
  <div data-narrate lang="es">Paso 1 de 3. ¿Cómo se llama?</div>
```

Short codes use US English and US Spanish by default. Change that with `StepNarrator.configure({ regions: { en: 'en-GB', es: 'es-ES' } })`.

## Several apps on one domain

Give each its own `storageKey`, so the choice in one does not turn on another:

```js
StepNarrator.configure({ storageKey: 'booking-app.voice' });
```

or `<script src="step-narrator.js" data-storage-key="booking-app.voice"></script>`.
