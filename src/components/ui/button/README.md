# Forest Products System Custom Button

A consistent button component with forest-themed styling for use throughout the Forest Products Collectors Monitoring System.

## Features

- Forest-themed color palette
- Multiple variants for different use cases
- Consistent styling across the application
- Support for icons, loading states, and different sizes
- Fully accessible and keyboard navigable

## Usage

```vue
<script setup>
import { CustomButton } from '@/components/ui/button';
import { Save } from 'lucide-vue-next'; // Optional: for icons
</script>

<template>
  <CustomButton 
    variant="primary" 
    size="default"
    :icon="Save"
    :loading="isLoading"
    @click="handleClick"
  >
    Save Changes
  </CustomButton>
</template>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `String` | `'primary'` | Button style variant (`'primary'`, `'secondary'`, `'danger'`, `'outline'`, `'ghost'`, `'link'`) |
| `size` | `String` | `'default'` | Button size (`'default'`, `'sm'`, `'lg'`, `'icon'`) |
| `class` | `String` | `''` | Additional CSS classes |
| `asChild` | `Boolean` | `false` | Whether to render as a child component |
| `as` | `String` | `'button'` | Element to render as |
| `disabled` | `Boolean` | `false` | Whether the button is disabled |
| `loading` | `Boolean` | `false` | Whether to show a loading spinner |
| `type` | `String` | `'button'` | Button type attribute |
| `icon` | `Object` | `null` | Icon component to display before the button text |
| `iconRight` | `Object` | `null` | Icon component to display after the button text |

## Variants

### Primary
```vue
<CustomButton variant="primary">Primary Button</CustomButton>
```
Green-themed button for primary actions.

### Secondary
```vue
<CustomButton variant="secondary">Secondary Button</CustomButton>
```
Light green button for secondary actions.

### Danger
```vue
<CustomButton variant="danger">Danger Button</CustomButton>
```
Red button for destructive actions.

### Outline
```vue
<CustomButton variant="outline">Outline Button</CustomButton>
```
Bordered button with transparent background.

### Ghost
```vue
<CustomButton variant="ghost">Ghost Button</CustomButton>
```
Button with no background until hovered.

### Link
```vue
<CustomButton variant="link">Link Button</CustomButton>
```
Button that looks like a link.

## Sizes

### Default
```vue
<CustomButton size="default">Default Size</CustomButton>
```

### Small
```vue
<CustomButton size="sm">Small Button</CustomButton>
```

### Large
```vue
<CustomButton size="lg">Large Button</CustomButton>
```

### Icon
```vue
<CustomButton size="icon"><PlusIcon /></CustomButton>
```
Square button for icons.

## States

### Disabled
```vue
<CustomButton disabled>Disabled Button</CustomButton>
```

### Loading
```vue
<CustomButton :loading="true">Loading Button</CustomButton>
```

## With Icons

### Left Icon
```vue
<CustomButton :icon="SaveIcon">Save</CustomButton>
```

### Right Icon
```vue
<CustomButton :iconRight="ChevronRightIcon">Next</CustomButton>
```

## Events

The component emits the standard `click` event when clicked, unless disabled or in loading state.

```vue
<CustomButton @click="handleClick">Click Me</CustomButton>
```
