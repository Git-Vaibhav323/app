import { Platform } from 'react-native';

/**
 * Skip On - Design System
 * 
 * Modern, premium UI design system following Apple HIG and Material Design principles.
 * Trustworthy, calm color palette optimized for stranger-interaction apps.
 * Professional yet friendly, accessible, and night-mode friendly.
 */

// ============================================
// COLOR SYSTEM - TRUSTWORTHY & CALM
// ============================================

export const Colors = {
  // Primary Color - Trustworthy Blue
  // WHY: Blue is associated with trust (73% user association), security, and professionalism
  // Used by major tech companies (LinkedIn, Facebook, Twitter) and banks
  // Builds confidence for stranger interactions
  primary: {
    light: '#3B82F6',    // Lighter blue for hover states, subtle backgrounds
    main: '#2563EB',     // Primary brand color - confident, trustworthy blue
    dark: '#1D4ED8',     // Darker variant for pressed states, emphasis
  },
  
  // Secondary Color - Calm Slate
  // WHY: Neutral gray-blue feels professional and stable without being cold
  // Perfect balance between approachable and serious
  secondary: {
    light: '#94A3B8',    // Light slate for subtle backgrounds, disabled states
    main: '#64748B',     // Main slate for secondary buttons, borders
    dark: '#475569',     // Dark slate for secondary text, icons
  },
  
  // Gradient Colors (for welcome screen background)
  // WHY: Subtle blue gradient maintains trust theme while adding depth
  // Not aggressive or playful - professional and calming
  gradient: {
    start: '#2563EB',    // Primary trustworthy blue
    end: '#3B82F6',      // Lighter blue for smooth transition
  },
  
  // Neutral Backgrounds - Calm & Safe
  // WHY: Clean, neutral backgrounds feel safe and uncluttered
  // Warm grays are friendlier than pure whites at night
  // Allows content to be the focus, not the background
  background: {
    primary: '#FFFFFF',      // Pure white for cards, modals
    secondary: '#F8FAFC',    // Soft warm gray for screens (night-friendly)
    tertiary: '#F1F5F9',     // Slightly darker gray for subtle sections
  },
  
  // Text Hierarchy - High Contrast for Accessibility
  // WHY: High contrast (21:1) ensures readability = feels professional
  // Clear hierarchy helps users understand information priority
  // Warm blacks feel less harsh than pure black
  text: {
    primary: '#0F172A',      // Near black, warm tone - high contrast (WCAG AAA)
    secondary: '#475569',    // Medium gray for body text - clear but not harsh
    tertiary: '#94A3B8',     // Light gray for hints/placeholders - subtle
    inverse: '#FFFFFF',      // White text on colored backgrounds
    link: '#2563EB',         // Primary blue for links - maintains trust theme
  },
  
  // Borders & Dividers - Subtle Separation
  border: {
    light: '#E2E8F0',        // Very light border - subtle separation
    medium: '#CBD5E0',       // Medium border - clear but not harsh
    dark: '#94A3B8',         // Darker border - matches secondary color palette
  },
  
  // Status Colors - Clear Feedback
  // WHY: Consistent, recognizable feedback colors build user confidence
  // Users understand actions and consequences clearly
  status: {
    success: '#10B981',      // Calm green - trust, confirmation
    error: '#EF4444',        // Alert red - caution, clear feedback
    warning: '#F59E0B',      // Warm amber - attention, not danger
    info: '#3B82F6',         // Light blue - matches primary palette
  },
  
  // Feature Accent Colors - Muted & Harmonious
  // WHY: Muted versions feel more mature while maintaining personality
  // Harmonious palette doesn't clash - feels cohesive and professional
  accent: {
    chat: '#2563EB',         // Primary blue - communication, trust
    engage: '#DB2777',       // Deep pink - warmth but less playful than before
    watch: '#F59E0B',        // Warm amber - entertainment, positive energy
    chess: '#2563EB',        // Primary blue - strategy, calm, focused
    sing: '#10B981',         // Green - harmony, positive, fresh
  },
  
  // Overlay & Shadow - Subtle Depth
  overlay: {
    light: 'rgba(0, 0, 0, 0.05)',   // Very subtle overlay
    medium: 'rgba(0, 0, 0, 0.1)',   // Medium overlay for modals
    dark: 'rgba(0, 0, 0, 0.3)',     // Dark overlay for emphasis
  },
} as const;

// ============================================
// TYPOGRAPHY SYSTEM
// ============================================

export const Typography = {
  // Font Families (System fonts for performance)
  fontFamily: {
    // iOS uses SF Pro, Android uses Roboto by default
    // Expo will automatically use system fonts
    regular: 'System',        // Will resolve to SF Pro / Roboto
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  
  // Font Sizes (8pt system)
  fontSize: {
    xs: 12,           // Helper text, badges
    sm: 14,           // Small body text
    base: 16,         // Body text, buttons
    lg: 18,           // Feature titles, emphasized text
    xl: 24,           // Section headings
    '2xl': 32,        // Screen titles
    '3xl': 40,        // Large display (logo)
    '4xl': 48,        // Hero text (welcome screen)
  },
  
  // Font Weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  
  // Line Heights (for readability)
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Text Styles (Pre-composed)
  styles: {
    // Hero / Logo
    hero: {
      fontSize: 48,
      fontWeight: '700' as const,
      lineHeight: 56,
      letterSpacing: -0.5,
    },
    
    // Screen Title
    h1: {
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 40,
      letterSpacing: -0.3,
    },
    
    // Section Heading
    h2: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 32,
      letterSpacing: -0.2,
    },
    
    // Feature Title
    h3: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    
    // Body Text
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
    },
    
    // Body Medium (for emphasis)
    bodyMedium: {
      fontSize: 16,
      fontWeight: '500' as const,
      lineHeight: 24,
    },
    
    // Small Text
    small: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    
    // Caption / Helper
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
    
    // Button Text
    button: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 20,
      letterSpacing: 0.2,
    },
  },
} as const;

// ============================================
// SPACING SYSTEM (8pt grid)
// ============================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

// ============================================
// BORDER RADIUS
// ============================================

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

// ============================================
// SHADOWS (Subtle, modern)
// ============================================

// Platform-specific shadow helper
const getShadowStyle = (level: 'sm' | 'md' | 'lg') => {
  const shadows = {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
      ...(Platform.OS === 'web' && {
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      }),
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
      ...(Platform.OS === 'web' && {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
      }),
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
      ...(Platform.OS === 'web' && {
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
      }),
    },
  };
  return shadows[level];
};

export const Shadows = {
  sm: getShadowStyle('sm'),
  md: getShadowStyle('md'),
  lg: getShadowStyle('lg'),
} as const;

// ============================================
// BUTTON STYLES
// ============================================

export const ButtonStyles = {
  // Primary Button (Main CTA)
  primary: {
    backgroundColor: Colors.primary.main,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  
  // Secondary Button (Outlined)
  secondary: {
    backgroundColor: 'transparent',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.text.inverse,
  },
  
  // Text Button (Link style)
  text: {
    backgroundColor: 'transparent',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
} as const;

// ============================================
// INPUT STYLES
// ============================================

export const InputStyles = {
  default: {
    backgroundColor: Colors.background.primary,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
  },
  focused: {
    borderColor: Colors.primary.main,
    borderWidth: 2,
  },
} as const;

