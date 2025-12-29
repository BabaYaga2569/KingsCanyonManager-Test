// Design Library - SVG-based elements for landscaping visualization
// Each element includes SVG path data, category, and metadata

export const designLibrary = {
  // ============================================
  // 💧 POOLS & WATER FEATURES
  // ============================================
  pools: [
    {
      id: 'pool-rectangle-small',
      name: 'Rectangle Pool (Small)',
      category: 'pools',
      subcategory: 'pools',
      size: { width: 200, height: 120 },
      color: '#4A90E2',
      svg: `<rect width="200" height="120" rx="8" fill="#4A90E2" stroke="#2E5C8A" stroke-width="3"/>
            <rect x="10" y="10" width="180" height="100" rx="5" fill="#6BB6FF" opacity="0.5"/>`,
      tags: ['pool', 'rectangle', 'small', 'water'],
      description: 'Small rectangular pool, perfect for compact yards'
    },
    {
      id: 'pool-rectangle-medium',
      name: 'Rectangle Pool (Medium)',
      category: 'pools',
      subcategory: 'pools',
      size: { width: 300, height: 150 },
      color: '#4A90E2',
      svg: `<rect width="300" height="150" rx="10" fill="#4A90E2" stroke="#2E5C8A" stroke-width="3"/>
            <rect x="15" y="15" width="270" height="120" rx="6" fill="#6BB6FF" opacity="0.5"/>`,
      tags: ['pool', 'rectangle', 'medium', 'water'],
      description: 'Medium rectangular pool, classic design'
    },
    {
      id: 'pool-rectangle-large',
      name: 'Rectangle Pool (Large)',
      category: 'pools',
      subcategory: 'pools',
      size: { width: 400, height: 200 },
      color: '#4A90E2',
      svg: `<rect width="400" height="200" rx="12" fill="#4A90E2" stroke="#2E5C8A" stroke-width="4"/>
            <rect x="20" y="20" width="360" height="160" rx="8" fill="#6BB6FF" opacity="0.5"/>`,
      tags: ['pool', 'rectangle', 'large', 'water'],
      description: 'Large rectangular pool for spacious backyards'
    },
    {
      id: 'pool-kidney',
      name: 'Kidney Pool',
      category: 'pools',
      subcategory: 'pools',
      size: { width: 320, height: 200 },
      color: '#4A90E2',
      svg: `<path d="M 160 20 Q 280 20 300 100 Q 280 180 160 180 Q 80 180 40 100 Q 80 20 160 20 Z" 
                  fill="#4A90E2" stroke="#2E5C8A" stroke-width="3"/>
            <path d="M 160 35 Q 265 35 285 100 Q 265 165 160 165 Q 95 165 55 100 Q 95 35 160 35 Z" 
                  fill="#6BB6FF" opacity="0.5"/>`,
      tags: ['pool', 'kidney', 'organic', 'water'],
      description: 'Classic kidney-shaped pool'
    },
    {
      id: 'pool-oval',
      name: 'Oval Pool',
      category: 'pools',
      subcategory: 'pools',
      size: { width: 300, height: 180 },
      color: '#4A90E2',
      svg: `<ellipse cx="150" cy="90" rx="150" ry="90" fill="#4A90E2" stroke="#2E5C8A" stroke-width="3"/>
            <ellipse cx="150" cy="90" rx="130" ry="70" fill="#6BB6FF" opacity="0.5"/>`,
      tags: ['pool', 'oval', 'water'],
      description: 'Elegant oval pool design'
    },
    {
      id: 'jacuzzi-round',
      name: 'Round Jacuzzi',
      category: 'pools',
      subcategory: 'spa',
      size: { width: 150, height: 150 },
      color: '#5DADE2',
      svg: `<circle cx="75" cy="75" r="75" fill="#5DADE2" stroke="#3498DB" stroke-width="3"/>
            <circle cx="75" cy="75" r="60" fill="#85C1E9" opacity="0.6"/>
            <circle cx="60" cy="60" r="8" fill="white" opacity="0.8"/>
            <circle cx="90" cy="60" r="8" fill="white" opacity="0.8"/>
            <circle cx="60" cy="90" r="8" fill="white" opacity="0.8"/>
            <circle cx="90" cy="90" r="8" fill="white" opacity="0.8"/>`,
      tags: ['jacuzzi', 'spa', 'hot tub', 'round', 'water'],
      description: 'Round jacuzzi/spa with jets'
    },
    {
      id: 'jacuzzi-square',
      name: 'Square Spa',
      category: 'pools',
      subcategory: 'spa',
      size: { width: 160, height: 160 },
      color: '#5DADE2',
      svg: `<rect width="160" height="160" rx="12" fill="#5DADE2" stroke="#3498DB" stroke-width="3"/>
            <rect x="15" y="15" width="130" height="130" rx="8" fill="#85C1E9" opacity="0.6"/>
            <circle cx="50" cy="50" r="8" fill="white" opacity="0.8"/>
            <circle cx="110" cy="50" r="8" fill="white" opacity="0.8"/>
            <circle cx="50" cy="110" r="8" fill="white" opacity="0.8"/>
            <circle cx="110" cy="110" r="8" fill="white" opacity="0.8"/>`,
      tags: ['jacuzzi', 'spa', 'hot tub', 'square', 'water'],
      description: 'Square spa/hot tub'
    },
    {
      id: 'fountain',
      name: 'Fountain',
      category: 'pools',
      subcategory: 'features',
      size: { width: 100, height: 120 },
      color: '#76D7C4',
      svg: `<ellipse cx="50" cy="100" rx="50" ry="20" fill="#AED6F1" stroke="#5DADE2" stroke-width="2"/>
            <rect x="35" y="50" width="30" height="50" fill="#85929E" stroke="#566573" stroke-width="2"/>
            <ellipse cx="50" cy="50" rx="20" ry="10" fill="#AED6F1" stroke="#5DADE2" stroke-width="2"/>
            <path d="M 50 50 Q 45 30 50 20 Q 55 30 50 50" fill="#D6EAF8" opacity="0.7"/>`,
      tags: ['fountain', 'water feature', 'decorative'],
      description: 'Decorative fountain'
    }
  ],

  // ============================================
  // 🏗️ PATIOS & HARDSCAPE
  // ============================================
  patios: [
    {
      id: 'patio-square-small',
      name: 'Square Patio (Small)',
      category: 'patios',
      subcategory: 'patio',
      size: { width: 180, height: 180 },
      color: '#D7CCC8',
      svg: `<rect width="180" height="180" rx="4" fill="#D7CCC8" stroke="#8D6E63" stroke-width="3"/>
            <line x1="0" y1="60" x2="180" y2="60" stroke="#A1887F" stroke-width="2"/>
            <line x1="0" y1="120" x2="180" y2="120" stroke="#A1887F" stroke-width="2"/>
            <line x1="60" y1="0" x2="60" y2="180" stroke="#A1887F" stroke-width="2"/>
            <line x1="120" y1="0" x2="120" y2="180" stroke="#A1887F" stroke-width="2"/>`,
      tags: ['patio', 'square', 'small', 'pavers'],
      description: 'Small square patio with paver pattern'
    },
    {
      id: 'patio-square-large',
      name: 'Square Patio (Large)',
      category: 'patios',
      subcategory: 'patio',
      size: { width: 300, height: 300 },
      color: '#D7CCC8',
      svg: `<rect width="300" height="300" rx="6" fill="#D7CCC8" stroke="#8D6E63" stroke-width="4"/>
            <line x1="0" y1="100" x2="300" y2="100" stroke="#A1887F" stroke-width="2"/>
            <line x1="0" y1="200" x2="300" y2="200" stroke="#A1887F" stroke-width="2"/>
            <line x1="100" y1="0" x2="100" y2="300" stroke="#A1887F" stroke-width="2"/>
            <line x1="200" y1="0" x2="200" y2="300" stroke="#A1887F" stroke-width="2"/>`,
      tags: ['patio', 'square', 'large', 'pavers'],
      description: 'Large square patio'
    },
    {
      id: 'patio-halfmoon',
      name: 'Half Moon Patio',
      category: 'patios',
      subcategory: 'patio',
      size: { width: 320, height: 180 },
      color: '#D7CCC8',
      svg: `<path d="M 0 180 L 0 0 Q 160 180 320 0 L 320 180 Z" fill="#D7CCC8" stroke="#8D6E63" stroke-width="3"/>
            <path d="M 20 160 Q 160 150 300 160" stroke="#A1887F" stroke-width="2" fill="none"/>
            <path d="M 40 120 Q 160 110 280 120" stroke="#A1887F" stroke-width="2" fill="none"/>
            <path d="M 60 80 Q 160 70 260 80" stroke="#A1887F" stroke-width="2" fill="none"/>`,
      tags: ['patio', 'half moon', 'curved', 'flagstone'],
      description: 'Half moon shaped patio - very popular!'
    },
    {
      id: 'patio-circle',
      name: 'Circular Patio',
      category: 'patios',
      subcategory: 'patio',
      size: { width: 250, height: 250 },
      color: '#D7CCC8',
      svg: `<circle cx="125" cy="125" r="125" fill="#D7CCC8" stroke="#8D6E63" stroke-width="3"/>
            <circle cx="125" cy="125" r="95" fill="none" stroke="#A1887F" stroke-width="2"/>
            <circle cx="125" cy="125" r="65" fill="none" stroke="#A1887F" stroke-width="2"/>
            <circle cx="125" cy="125" r="35" fill="none" stroke="#A1887F" stroke-width="2"/>`,
      tags: ['patio', 'circle', 'round', 'pavers'],
      description: 'Circular patio with concentric pattern'
    },
    {
      id: 'patio-rectangle',
      name: 'Rectangle Patio',
      category: 'patios',
      subcategory: 'patio',
      size: { width: 350, height: 220 },
      color: '#D7CCC8',
      svg: `<rect width="350" height="220" rx="6" fill="#D7CCC8" stroke="#8D6E63" stroke-width="3"/>
            <line x1="0" y1="73" x2="350" y2="73" stroke="#A1887F" stroke-width="2"/>
            <line x1="0" y1="147" x2="350" y2="147" stroke="#A1887F" stroke-width="2"/>
            <line x1="117" y1="0" x2="117" y2="220" stroke="#A1887F" stroke-width="2"/>
            <line x1="233" y1="0" x2="233" y2="220" stroke="#A1887F" stroke-width="2"/>`,
      tags: ['patio', 'rectangle', 'pavers'],
      description: 'Rectangle patio'
    },
    {
      id: 'walkway-straight',
      name: 'Straight Walkway',
      category: 'patios',
      subcategory: 'walkway',
      size: { width: 300, height: 80 },
      color: '#BCAAA4',
      svg: `<rect width="300" height="80" rx="4" fill="#BCAAA4" stroke="#8D6E63" stroke-width="2"/>
            <line x1="100" y1="0" x2="100" y2="80" stroke="#A1887F" stroke-width="1.5"/>
            <line x1="200" y1="0" x2="200" y2="80" stroke="#A1887F" stroke-width="1.5"/>`,
      tags: ['walkway', 'path', 'straight'],
      description: 'Straight paver walkway'
    },
    {
      id: 'walkway-curved',
      name: 'Curved Walkway',
      category: 'patios',
      subcategory: 'walkway',
      size: { width: 320, height: 100 },
      color: '#BCAAA4',
      svg: `<path d="M 0 50 Q 80 20 160 50 Q 240 80 320 50" stroke="#8D6E63" stroke-width="80" fill="none" stroke-linecap="round"/>
            <path d="M 0 50 Q 80 20 160 50 Q 240 80 320 50" stroke="#A1887F" stroke-width="2" fill="none"/>`,
      tags: ['walkway', 'path', 'curved'],
      description: 'Curved paver walkway'
    },
    {
      id: 'stepping-stones',
      name: 'Stepping Stones',
      category: 'patios',
      subcategory: 'walkway',
      size: { width: 300, height: 120 },
      color: '#A1887F',
      svg: `<ellipse cx="50" cy="60" rx="35" ry="30" fill="#A1887F" stroke="#8D6E63" stroke-width="2"/>
            <ellipse cx="140" cy="40" rx="38" ry="32" fill="#A1887F" stroke="#8D6E63" stroke-width="2"/>
            <ellipse cx="230" cy="70" rx="36" ry="31" fill="#A1887F" stroke="#8D6E63" stroke-width="2"/>`,
      tags: ['stepping stones', 'path', 'natural'],
      description: 'Natural stepping stones'
    }
  ],

  // ============================================
  // 🔥 FIRE FEATURES
  // ============================================
  fire: [
    {
      id: 'firepit-round',
      name: 'Round Fire Pit',
      category: 'fire',
      subcategory: 'firepit',
      size: { width: 140, height: 140 },
      color: '#8D6E63',
      svg: `<circle cx="70" cy="70" r="70" fill="#8D6E63" stroke="#5D4037" stroke-width="3"/>
            <circle cx="70" cy="70" r="50" fill="#6D4C41" stroke="#5D4037" stroke-width="2"/>
            <circle cx="70" cy="70" r="30" fill="#FF6F00" opacity="0.8"/>
            <path d="M 60 70 Q 65 50 70 60 Q 75 50 80 70" fill="#FFA726" opacity="0.7"/>
            <path d="M 65 70 Q 68 55 70 65 Q 72 55 75 70" fill="#FFB74D" opacity="0.6"/>`,
      tags: ['fire pit', 'round', 'fire', 'outdoor'],
      description: 'Round stone fire pit'
    },
    {
      id: 'firepit-square',
      name: 'Square Fire Pit',
      category: 'fire',
      subcategory: 'firepit',
      size: { width: 150, height: 150 },
      color: '#8D6E63',
      svg: `<rect width="150" height="150" rx="8" fill="#8D6E63" stroke="#5D4037" stroke-width="3"/>
            <rect x="20" y="20" width="110" height="110" rx="5" fill="#6D4C41" stroke="#5D4037" stroke-width="2"/>
            <circle cx="75" cy="75" r="30" fill="#FF6F00" opacity="0.8"/>
            <path d="M 65 75 Q 70 55 75 65 Q 80 55 85 75" fill="#FFA726" opacity="0.7"/>`,
      tags: ['fire pit', 'square', 'fire', 'modern'],
      description: 'Modern square fire pit'
    },
    {
      id: 'fireplace-outdoor',
      name: 'Outdoor Fireplace',
      category: 'fire',
      subcategory: 'fireplace',
      size: { width: 120, height: 180 },
      color: '#8D6E63',
      svg: `<rect width="120" height="180" rx="6" fill="#8D6E63" stroke="#5D4037" stroke-width="3"/>
            <rect x="20" y="100" width="80" height="60" rx="4" fill="#424242" stroke="#212121" stroke-width="2"/>
            <rect x="30" y="110" width="60" height="40" rx="3" fill="#FF6F00" opacity="0.8"/>
            <path d="M 50 130 Q 55 115 60 125 Q 65 115 70 130" fill="#FFA726" opacity="0.7"/>
            <rect x="40" y="10" width="40" height="20" rx="3" fill="#5D4037"/>`,
      tags: ['fireplace', 'outdoor', 'fire', 'chimney'],
      description: 'Outdoor fireplace with chimney'
    }
  ],

  // ============================================
  // 💡 LIGHTING
  // ============================================
  lighting: [
    {
      id: 'string-lights-straight',
      name: 'String Lights (Straight)',
      category: 'lighting',
      subcategory: 'string',
      size: { width: 300, height: 40 },
      color: '#FFF59D',
      svg: `<line x1="0" y1="20" x2="300" y2="20" stroke="#757575" stroke-width="2"/>
            <circle cx="30" cy="20" r="8" fill="#FFF59D" stroke="#FFD54F" stroke-width="2" opacity="0.9"/>
            <circle cx="90" cy="20" r="8" fill="#FFF59D" stroke="#FFD54F" stroke-width="2" opacity="0.9"/>
            <circle cx="150" cy="20" r="8" fill="#FFF59D" stroke="#FFD54F" stroke-width="2" opacity="0.9"/>
            <circle cx="210" cy="20" r="8" fill="#FFF59D" stroke="#FFD54F" stroke-width="2" opacity="0.9"/>
            <circle cx="270" cy="20" r="8" fill="#FFF59D" stroke="#FFD54F" stroke-width="2" opacity="0.9"/>`,
      tags: ['string lights', 'lighting', 'ambiance'],
      description: 'Straight string lights'
    },
    {
      id: 'string-lights-zigzag',
      name: 'String Lights (Zigzag)',
      category: 'lighting',
      subcategory: 'string',
      size: { width: 320, height: 80 },
      color: '#FFF59D',
      svg: `<path d="M 0 40 L 80 20 L 160 60 L 240 20 L 320 40" stroke="#757575" stroke-width="2" fill="none"/>
            <circle cx="40" cy="30" r="8" fill="#FFF59D" stroke="#FFD54F" stroke-width="2" opacity="0.9"/>
            <circle cx="120" cy="40" r="8" fill="#FFF59D" stroke="#FFD54F" stroke-width="2" opacity="0.9"/>
            <circle cx="200" cy="40" r="8" fill="#FFF59D" stroke="#FFD54F" stroke-width="2" opacity="0.9"/>
            <circle cx="280" cy="30" r="8" fill="#FFF59D" stroke="#FFD54F" stroke-width="2" opacity="0.9"/>`,
      tags: ['string lights', 'lighting', 'zigzag', 'ambiance'],
      description: 'Zigzag string lights'
    },
    {
      id: 'path-lights',
      name: 'Path Lights',
      category: 'lighting',
      subcategory: 'path',
      size: { width: 40, height: 60 },
      color: '#B0BEC5',
      svg: `<rect x="15" y="40" width="10" height="20" fill="#78909C" stroke="#546E7A" stroke-width="1"/>
            <circle cx="20" cy="35" r="12" fill="#B0BEC5" stroke="#78909C" stroke-width="2"/>
            <circle cx="20" cy="35" r="8" fill="#FFF59D" opacity="0.7"/>`,
      tags: ['path lights', 'lighting', 'ground'],
      description: 'Path/bollard light'
    },
    {
      id: 'spotlight',
      name: 'Spotlight',
      category: 'lighting',
      subcategory: 'accent',
      size: { width: 50, height: 60 },
      color: '#78909C',
      svg: `<rect x="18" y="45" width="14" height="15" fill="#546E7A" stroke="#37474F" stroke-width="1"/>
            <path d="M 15 45 L 35 45 L 38 25 L 12 25 Z" fill="#78909C" stroke="#546E7A" stroke-width="2"/>
            <path d="M 25 25 L 10 0 L 40 0 Z" fill="#FFF59D" opacity="0.4"/>`,
      tags: ['spotlight', 'accent lighting', 'uplight'],
      description: 'Accent spotlight'
    }
  ],

  // ============================================
  // 🏛️ STRUCTURES
  // ============================================
  structures: [
    {
      id: 'pergola-small',
      name: 'Pergola (Small)',
      category: 'structures',
      subcategory: 'shade',
      size: { width: 200, height: 200 },
      color: '#8D6E63',
      svg: `<rect x="10" y="10" width="10" height="180" fill="#8D6E63" stroke="#5D4037" stroke-width="2"/>
            <rect x="180" y="10" width="10" height="180" fill="#8D6E63" stroke="#5D4037" stroke-width="2"/>
            <rect x="0" y="5" width="200" height="15" fill="#A1887F" stroke="#8D6E63" stroke-width="2"/>
            <rect x="0" y="30" width="200" height="8" fill="#BCAAA4" opacity="0.7"/>
            <rect x="0" y="50" width="200" height="8" fill="#BCAAA4" opacity="0.7"/>
            <rect x="0" y="70" width="200" height="8" fill="#BCAAA4" opacity="0.7"/>`,
      tags: ['pergola', 'shade', 'structure'],
      description: 'Small pergola structure'
    },
    {
      id: 'pergola-large',
      name: 'Pergola (Large)',
      category: 'structures',
      subcategory: 'shade',
      size: { width: 300, height: 250 },
      color: '#8D6E63',
      svg: `<rect x="15" y="15" width="15" height="220" fill="#8D6E63" stroke="#5D4037" stroke-width="2"/>
            <rect x="270" y="15" width="15" height="220" fill="#8D6E63" stroke="#5D4037" stroke-width="2"/>
            <rect x="0" y="8" width="300" height="20" fill="#A1887F" stroke="#8D6E63" stroke-width="2"/>
            <rect x="0" y="40" width="300" height="10" fill="#BCAAA4" opacity="0.7"/>
            <rect x="0" y="65" width="300" height="10" fill="#BCAAA4" opacity="0.7"/>
            <rect x="0" y="90" width="300" height="10" fill="#BCAAA4" opacity="0.7"/>`,
      tags: ['pergola', 'shade', 'structure', 'large'],
      description: 'Large pergola structure'
    },
    {
      id: 'gazebo',
      name: 'Gazebo',
      category: 'structures',
      subcategory: 'shade',
      size: { width: 180, height: 180 },
      color: '#8D6E63',
      svg: `<polygon points="90,10 170,90 90,170 10,90" fill="#A1887F" stroke="#8D6E63" stroke-width="3"/>
            <circle cx="90" cy="90" r="70" fill="none" stroke="#8D6E63" stroke-width="2"/>
            <circle cx="90" cy="90" r="6" fill="#8D6E63"/>
            <line x1="90" y1="90" x2="30" y2="90" stroke="#8D6E63" stroke-width="2"/>
            <line x1="90" y1="90" x2="150" y2="90" stroke="#8D6E63" stroke-width="2"/>
            <line x1="90" y1="90" x2="90" y2="30" stroke="#8D6E63" stroke-width="2"/>
            <line x1="90" y1="90" x2="90" y2="150" stroke="#8D6E63" stroke-width="2"/>`,
      tags: ['gazebo', 'shade', 'structure', 'octagon'],
      description: 'Octagonal gazebo'
    },
    {
      id: 'bbq-island',
      name: 'BBQ Island',
      category: 'structures',
      subcategory: 'kitchen',
      size: { width: 220, height: 100 },
      color: '#8D6E63',
      svg: `<rect width="220" height="100" rx="6" fill="#8D6E63" stroke="#5D4037" stroke-width="3"/>
            <rect x="140" y="15" width="60" height="50" rx="4" fill="#424242" stroke="#212121" stroke-width="2"/>
            <circle cx="170" cy="30" r="8" fill="#616161"/>
            <circle cx="170" cy="50" r="8" fill="#616161"/>
            <rect x="20" y="20" width="100" height="60" rx="4" fill="#A1887F" stroke="#8D6E63" stroke-width="2"/>`,
      tags: ['bbq', 'outdoor kitchen', 'grill', 'island'],
      description: 'Outdoor BBQ island'
    }
  ],

  // ============================================
  // 🌳 LANDSCAPING
  // ============================================
  landscaping: [
    {
      id: 'tree-large',
      name: 'Large Tree',
      category: 'landscaping',
      subcategory: 'trees',
      size: { width: 120, height: 140 },
      color: '#66BB6A',
      svg: `<rect x="52" y="90" width="16" height="50" fill="#8D6E63" stroke="#5D4037" stroke-width="2"/>
            <circle cx="60" cy="70" r="50" fill="#66BB6A" stroke="#4CAF50" stroke-width="2" opacity="0.9"/>
            <circle cx="40" cy="80" r="35" fill="#66BB6A" stroke="#4CAF50" stroke-width="2" opacity="0.8"/>
            <circle cx="80" cy="80" r="35" fill="#66BB6A" stroke="#4CAF50" stroke-width="2" opacity="0.8"/>`,
      tags: ['tree', 'large', 'shade', 'green'],
      description: 'Large shade tree'
    },
    {
      id: 'palm-tree',
      name: 'Palm Tree',
      category: 'landscaping',
      subcategory: 'trees',
      size: { width: 100, height: 160 },
      color: '#66BB6A',
      svg: `<rect x="45" y="70" width="10" height="90" fill="#8D6E63" stroke="#5D4037" stroke-width="2"/>
            <path d="M 50 70 Q 20 50 10 40" stroke="#66BB6A" stroke-width="8" fill="none" stroke-linecap="round"/>
            <path d="M 50 70 Q 80 50 90 40" stroke="#66BB6A" stroke-width="8" fill="none" stroke-linecap="round"/>
            <path d="M 50 70 Q 30 40 20 20" stroke="#66BB6A" stroke-width="8" fill="none" stroke-linecap="round"/>
            <path d="M 50 70 Q 70 40 80 20" stroke="#66BB6A" stroke-width="8" fill="none" stroke-linecap="round"/>
            <path d="M 50 70 L 50 30" stroke="#66BB6A" stroke-width="8" stroke-linecap="round"/>`,
      tags: ['palm', 'tree', 'tropical', 'desert'],
      description: 'Palm tree'
    },
    {
      id: 'saguaro-cactus',
      name: 'Saguaro Cactus',
      category: 'landscaping',
      subcategory: 'desert',
      size: { width: 80, height: 140 },
      color: '#81C784',
      svg: `<rect x="32" y="40" width="16" height="100" rx="8" fill="#81C784" stroke="#66BB6A" stroke-width="2"/>
            <rect x="12" y="60" width="12" height="40" rx="6" fill="#81C784" stroke="#66BB6A" stroke-width="2"/>
            <rect x="56" y="50" width="12" height="50" rx="6" fill="#81C784" stroke="#66BB6A" stroke-width="2"/>`,
      tags: ['cactus', 'saguaro', 'desert', 'arizona'],
      description: 'Saguaro cactus - Arizona icon'
    },
    {
      id: 'barrel-cactus',
      name: 'Barrel Cactus',
      category: 'landscaping',
      subcategory: 'desert',
      size: { width: 60, height: 70 },
      color: '#81C784',
      svg: `<ellipse cx="30" cy="50" rx="28" ry="35" fill="#81C784" stroke="#66BB6A" stroke-width="2"/>
            <line x1="30" y1="15" x2="30" y2="85" stroke="#66BB6A" stroke-width="1.5"/>
            <line x1="15" y1="25" x2="15" y2="75" stroke="#66BB6A" stroke-width="1.5"/>
            <line x1="45" y1="25" x2="45" y2="75" stroke="#66BB6A" stroke-width="1.5"/>
            <circle cx="30" cy="20" r="4" fill="#FF6F00"/>`,
      tags: ['cactus', 'barrel', 'desert', 'succulent'],
      description: 'Barrel cactus'
    },
    {
      id: 'agave',
      name: 'Agave Plant',
      category: 'landscaping',
      subcategory: 'desert',
      size: { width: 90, height: 80 },
      color: '#A5D6A7',
      svg: `<ellipse cx="45" cy="60" rx="40" ry="15" fill="#C8E6C9" opacity="0.5"/>
            <path d="M 45 60 L 45 10" stroke="#66BB6A" stroke-width="10" fill="none"/>
            <path d="M 45 60 L 20 30" stroke="#66BB6A" stroke-width="9" fill="none"/>
            <path d="M 45 60 L 70 30" stroke="#66BB6A" stroke-width="9" fill="none"/>
            <path d="M 45 60 L 15 50" stroke="#66BB6A" stroke-width="8" fill="none"/>
            <path d="M 45 60 L 75 50" stroke="#66BB6A" stroke-width="8" fill="none"/>
            <path d="M 45 60 L 10 65" stroke="#66BB6A" stroke-width="7" fill="none"/>
            <path d="M 45 60 L 80 65" stroke="#66BB6A" stroke-width="7" fill="none"/>`,
      tags: ['agave', 'desert', 'succulent', 'spiky'],
      description: 'Desert agave plant'
    },
    {
      id: 'flowerbed-rectangle',
      name: 'Flower Bed (Rectangle)',
      category: 'landscaping',
      subcategory: 'flowers',
      size: { width: 200, height: 80 },
      color: '#F48FB1',
      svg: `<rect width="200" height="80" rx="6" fill="#8D6E63" stroke="#5D4037" stroke-width="2" opacity="0.3"/>
            <circle cx="30" cy="40" r="12" fill="#F48FB1" stroke="#EC407A" stroke-width="2"/>
            <circle cx="70" cy="35" r="12" fill="#CE93D8" stroke="#AB47BC" stroke-width="2"/>
            <circle cx="110" cy="45" r="12" fill="#FFF59D" stroke="#FBC02D" stroke-width="2"/>
            <circle cx="150" cy="35" r="12" fill="#F48FB1" stroke="#EC407A" stroke-width="2"/>
            <circle cx="50" cy="55" r="10" fill="#CE93D8" stroke="#AB47BC" stroke-width="2"/>
            <circle cx="90" cy="60" r="10" fill="#FFF59D" stroke="#FBC02D" stroke-width="2"/>
            <circle cx="130" cy="55" r="10" fill="#F48FB1" stroke="#EC407A" stroke-width="2"/>
            <circle cx="170" cy="50" r="10" fill="#CE93D8" stroke="#AB47BC" stroke-width="2"/>`,
      tags: ['flowers', 'flower bed', 'garden', 'colorful'],
      description: 'Colorful flower bed'
    },
    {
      id: 'shrub-round',
      name: 'Round Shrub',
      category: 'landscaping',
      subcategory: 'shrubs',
      size: { width: 70, height: 70 },
      color: '#66BB6A',
      svg: `<circle cx="35" cy="35" r="35" fill="#66BB6A" stroke="#4CAF50" stroke-width="2" opacity="0.9"/>
            <circle cx="25" cy="28" r="18" fill="#81C784" opacity="0.7"/>
            <circle cx="45" cy="32" r="15" fill="#81C784" opacity="0.7"/>`,
      tags: ['shrub', 'bush', 'round', 'green'],
      description: 'Round decorative shrub'
    },
    {
      id: 'grass-patch',
      name: 'Grass Area',
      category: 'landscaping',
      subcategory: 'ground',
      size: { width: 150, height: 120 },
      color: '#81C784',
      svg: `<rect width="150" height="120" rx="8" fill="#81C784" stroke="#66BB6A" stroke-width="2" opacity="0.6"/>
            <path d="M 20 20 L 25 15 L 30 20" stroke="#66BB6A" stroke-width="1.5" fill="none"/>
            <path d="M 50 30 L 55 25 L 60 30" stroke="#66BB6A" stroke-width="1.5" fill="none"/>
            <path d="M 80 40 L 85 35 L 90 40" stroke="#66BB6A" stroke-width="1.5" fill="none"/>
            <path d="M 110 25 L 115 20 L 120 25" stroke="#66BB6A" stroke-width="1.5" fill="none"/>`,
      tags: ['grass', 'lawn', 'green', 'turf'],
      description: 'Grass/lawn area'
    }
  ],

  // ============================================
  // 🪨 ROCK & BORDERS
  // ============================================
  rocks: [
    {
      id: 'rock-border',
      name: 'Rock Border',
      category: 'rocks',
      subcategory: 'border',
      size: { width: 280, height: 40 },
      color: '#A1887F',
      svg: `<ellipse cx="30" cy="25" rx="25" ry="18" fill="#A1887F" stroke="#8D6E63" stroke-width="2"/>
            <ellipse cx="80" cy="22" rx="28" ry="20" fill="#A1887F" stroke="#8D6E63" stroke-width="2"/>
            <ellipse cx="140" cy="24" rx="26" ry="19" fill="#A1887F" stroke="#8D6E63" stroke-width="2"/>
            <ellipse cx="200" cy="21" rx="30" ry="21" fill="#A1887F" stroke="#8D6E63" stroke-width="2"/>
            <ellipse cx="260" cy="23" rx="27" ry="18" fill="#A1887F" stroke="#8D6E63" stroke-width="2"/>`,
      tags: ['rocks', 'border', 'natural', 'stone'],
      description: 'Natural rock border'
    },
    {
      id: 'boulder',
      name: 'Large Boulder',
      category: 'rocks',
      subcategory: 'accent',
      size: { width: 90, height: 80 },
      color: '#8D6E63',
      svg: `<ellipse cx="45" cy="50" rx="45" ry="40" fill="#8D6E63" stroke="#5D4037" stroke-width="3"/>
            <ellipse cx="35" cy="45" rx="20" ry="18" fill="#A1887F" opacity="0.5"/>
            <ellipse cx="55" cy="52" rx="15" ry="13" fill="#A1887F" opacity="0.5"/>`,
      tags: ['boulder', 'rock', 'large', 'accent'],
      description: 'Large decorative boulder'
    },
    {
      id: 'gravel-area',
      name: 'Gravel Area',
      category: 'rocks',
      subcategory: 'ground',
      size: { width: 180, height: 140 },
      color: '#BCAAA4',
      svg: `<rect width="180" height="140" rx="6" fill="#BCAAA4" stroke="#A1887F" stroke-width="2"/>
            <circle cx="30" cy="30" r="3" fill="#8D6E63" opacity="0.8"/>
            <circle cx="60" cy="45" r="3" fill="#8D6E63" opacity="0.8"/>
            <circle cx="90" cy="35" r="3" fill="#8D6E63" opacity="0.8"/>
            <circle cx="120" cy="50" r="3" fill="#8D6E63" opacity="0.8"/>
            <circle cx="150" cy="40" r="3" fill="#8D6E63" opacity="0.8"/>
            <circle cx="45" cy="70" r="3" fill="#8D6E63" opacity="0.8"/>
            <circle cx="75" cy="85" r="3" fill="#8D6E63" opacity="0.8"/>
            <circle cx="105" cy="75" r="3" fill="#8D6E63" opacity="0.8"/>
            <circle cx="135" cy="90" r="3" fill="#8D6E63" opacity="0.8"/>
            <circle cx="30" cy="105" r="3" fill="#8D6E63" opacity="0.8"/>
            <circle cx="90" cy="110" r="3" fill="#8D6E63" opacity="0.8"/>
            <circle cx="150" cy="100" r="3" fill="#8D6E63" opacity="0.8"/>`,
      tags: ['gravel', 'rocks', 'ground cover', 'desert'],
      description: 'Gravel ground cover'
    }
  ]
};

// Helper function to get all elements as flat array
export const getAllElements = () => {
  const allElements = [];
  Object.keys(designLibrary).forEach(category => {
    allElements.push(...designLibrary[category]);
  });
  return allElements;
};

// Helper function to get elements by category
export const getElementsByCategory = (category) => {
  return designLibrary[category] || [];
};

// Helper function to search elements
export const searchElements = (searchTerm) => {
  const term = searchTerm.toLowerCase();
  return getAllElements().filter(element => 
    element.name.toLowerCase().includes(term) ||
    element.tags.some(tag => tag.toLowerCase().includes(term)) ||
    element.description.toLowerCase().includes(term)
  );
};

// Helper function to get element by ID
export const getElementById = (id) => {
  return getAllElements().find(element => element.id === id);
};

export default designLibrary;