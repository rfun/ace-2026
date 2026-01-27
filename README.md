# Asian Snacks & Treats Collection - Static Website

A beautiful, responsive static website showcasing a curated collection of Asian snacks and treats.

## Features

- 📱 Fully responsive design
- 🎨 Modern gradient UI with card-based layout
- 🔍 Filter by country of origin
- ⚠️ Detailed allergy information for each item
- 🌏 Cultural context and descriptions
- 📊 Statistics dashboard
- 🖼️ High-quality product images

## Deployment to GitHub Pages

### Option 1: Deploy from this directory

1. Create a new repository on GitHub
2. Initialize git in this directory:
   ```bash
   cd web-snack
   git init
   git add .
   git commit -m "Initial commit: Asian snacks collection"
   ```
3. Add remote and push:
   ```bash
   git remote add origin https://github.com/yourusername/asian-snacks.git
   git branch -M main
   git push -u origin main
   ```
4. Enable GitHub Pages:
   - Go to repository Settings > Pages
   - Select "main" branch and "/" (root) as source
   - Click Save
5. Your site will be live at: `https://yourusername.github.io/asian-snacks/`

### Option 2: Deploy from existing repository

If you want to add this to an existing repository:

1. Copy the `web-snack` folder to your repository
2. Commit and push:
   ```bash
   git add web-snack/
   git commit -m "Add Asian snacks collection website"
   git push
   ```
3. Enable GitHub Pages:
   - Go to repository Settings > Pages
   - Select "main" branch and "/web-snack" as source
   - Click Save
4. Your site will be live at: `https://yourusername.github.io/your-repo/web-snack/`

## Directory Structure

```
web-snack/
├── index.html          # Main HTML file with embedded CSS and JavaScript
├── images/             # Product images directory
│   ├── small_IMG_8740.jpg
│   ├── small_IMG_8741.jpg
│   └── ... (18 images total)
└── README.md           # This file
```

## Technology Stack

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with flexbox/grid, gradients, and animations
- **Vanilla JavaScript** - Filter functionality
- **No build process required** - Pure static files

## Features Details

### Filtering
Click on country buttons to filter snacks by their country of origin. Supports:
- China 🇨🇳
- Japan 🇯🇵
- Korea 🇰🇷
- India 🇮🇳
- Thailand 🇹🇭
- UAE 🇦🇪
- Indonesia 🇮🇩
- Turkey 🇹🇷

### Allergy Information
Each snack card includes color-coded allergy information:
- **Green** - Safe/minimal allergens
- **Yellow** - Moderate allergen content
- **Red** - High-risk allergens (multiple common allergens)

Common allergens tracked:
- Wheat/Gluten
- Milk/Dairy
- Eggs
- Soy
- Tree Nuts
- Shellfish
- Sesame
- Caffeine content

### Responsive Design
The website automatically adapts to different screen sizes:
- **Desktop**: 3-column grid layout
- **Tablet**: 2-column grid layout
- **Mobile**: Single column layout

## Customization

### Changing Colors
Edit the gradient in the `body` CSS:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Adding More Items
Add new snack cards to the `snacks-grid` div following the existing pattern. Don't forget to:
1. Add the product image to the `images/` folder
2. Set the appropriate `data-country` attribute
3. Include allergy information with appropriate CSS class
4. Update statistics in the stats bar

### Modifying Layout
The grid layout can be adjusted in the `.snacks-grid` CSS:
```css
grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Android)

## License

This project is free to use and modify.

## Disclaimer

Allergy information is provided as a general guide. Always check product packaging for accurate and up-to-date allergen information. This website is for informational purposes only.
