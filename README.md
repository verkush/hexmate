# 📦 HexMate — Number Conversion & Bitfield Tools for VS Code

> 🔢 Convert numbers between Decimal, Hex, Binary, and Octal right inside your code editor.  
> ⚡ Minimalist hover UI, inline previews, one-click replace, copy, and more.

![HexMate Banner](https://raw.githubusercontent.com/verkush/hexmate/refs/heads/master/media/banner.png)

---

## ✨ Features

✅ **Hover Conversions**  
- Hover any number (`0x83`, `131`, `0b1010`, `0o77`)  
- Get instant conversions: Decimal, Hex, Binary, Octal  
- Copy, Replace, Replace All (Exact), Replace All Equivalent  

✅ **Endianess View**  
- See Big-Endian and Little-Endian byte order instantly on hover  

✅ **Replace Options**  
- **Replace**: just this token  
- **Replace All**: only identical tokens (e.g. `0x83` only)  
- **Replace All ≡**: all equivalent values (`131`, `0x83`, `0b10000011`)  

✅ **Inline Decorations** *(toggleable)*  
- Show conversions inline after numbers in your code  

✅ **Calculator Panel**  
- Side-panel calculator for quick conversions  

✅ **Bitfield Visualizer**  
- Break down integers into bitfields interactively  

✅ **Status Bar Controls**  
- Toggle decorations on/off  
- Switch preferred number format (Decimal, Hex, Binary, Octal)  

---

## 🎥 Demo

### Hover Conversion
![Hover Demo](https://raw.githubusercontent.com/verkush/hexmate/refs/heads/master/media/hover.gif)

---

### Replace All (Exact vs Equivalent)
![Replace All Demo](https://raw.githubusercontent.com/verkush/hexmate/refs/heads/master/media/replaceAll.gif)

---

### Inline Decorations Toggle
![Decorations Toggle](https://raw.githubusercontent.com/verkush/hexmate/refs/heads/master/media/decoration.gif)

---

## ⚙️ Settings

```jsonc
// Enable/disable inline decorations
"hexmate.decorationsEnabled": true,

// Show both original and converted values inline
"hexmate.dualDisplay": true,

// Keywords before numbers that should be skipped in Replace All
"hexmate.skipContexts": ["return", "case", "throw", "goto"]
