document.addEventListener('DOMContentLoaded', () => {
    // Design reference dimensions - all splitConfig values are based on these
    const BASE_SPLIT_WIDTH = 1920;
    const BASE_SPLIT_HEIGHT = 911; 
    const pointerMedia =
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            ? window.matchMedia('(pointer: coarse)')
            : null; 
    let transitionDistance = 220;
    const tailPaddingFactor = 0.03;
    let pairedTransitionDistance = 280;
    let nonCaptionBaseFactor = 0.5;
    let nonCaptionMinHeight = 320;
    let useCompactSpacing = false;
    const pairedHeadPaddingFactor = 0.11;
    const pairedTailPaddingFactor = 0.15;
    const updateScrollSpacingSettings = () => {
        // Use shorter distances on touch/mobile so gallery transitions require less scroll.
        const narrowViewport = (window?.innerWidth || 0) <= 900;
        const isCoarsePointer = pointerMedia ? pointerMedia.matches : false;
        useCompactSpacing = isCoarsePointer || narrowViewport;

        if (useCompactSpacing) {
            transitionDistance = 130;
            pairedTransitionDistance = 200;
            nonCaptionBaseFactor = 0.24;
            nonCaptionMinHeight = 180;
        } else {
            transitionDistance = 220;
            pairedTransitionDistance = 280;
            nonCaptionBaseFactor = 0.5;
            nonCaptionMinHeight = 320;
        }
    };

    updateScrollSpacingSettings();
    const pairedInitialOffsetFactor = 0.08;
    const pairedFadeDuration = 240;
    const leftTransitionHolds = [0, 0];
    const getCaptionBaseBottom = () => -Math.max((window?.innerHeight || 800) * 0.6, 320);
    const getCaptionExtra = () => Math.max((window?.innerHeight || 0) * 1.25, 900);

    const iosUserAgent =
        window?.navigator?.userAgent || window?.navigator?.vendor || '';
    const isIOSDevice =
        /iPad|iPhone|iPod/i.test(iosUserAgent) ||
        (iosUserAgent.includes('Mac') && window?.navigator?.maxTouchPoints > 1);
    if (isIOSDevice) {
        document.body.classList.add('is-ios');
    }

    const setViewportHeightCSSVar = () => {
        const vh = window?.innerHeight || BASE_SPLIT_HEIGHT;
        document.documentElement.style.setProperty('--app-vh', `${vh}px`);
    };

    setViewportHeightCSSVar();

    const STEP_BASE_HEIGHT_FLOOR = 800;
    const getBaseStepHeight = () => {
        const viewportHeight = window?.innerHeight || BASE_SPLIT_HEIGHT;
        if (useCompactSpacing) {
            const compactFloor = STEP_BASE_HEIGHT_FLOOR * 0.6;
            return Math.max(viewportHeight * 1.12, compactFloor);
        }
        return Math.max(viewportHeight * 2, STEP_BASE_HEIGHT_FLOOR);
    };

    const getCaptionNodeHeight = (container, captionIndex) => {
        if (!container || captionIndex < 0) {
            return 0;
        }
        const captionNode = container.querySelector(
            `.split-caption[data-caption="${captionIndex}"]`
        );
        if (!captionNode) {
            return 0;
        }
        const height = captionNode.offsetHeight || captionNode.scrollHeight || 0;
        return height;
    };

    const computeStepScrollHeight = (cfg, container) => {
        const base = getBaseStepHeight();
        if (!cfg) {
            return base;
        }
        const captionIndex = cfg.captionIndex ?? -1;
        if (captionIndex < 0) {
            const viewportHeight = window?.innerHeight || BASE_SPLIT_HEIGHT;
            const baseFactor =
                typeof cfg.nonCaptionFactor === 'number'
                    ? cfg.nonCaptionFactor
                    : nonCaptionBaseFactor;
            const minHeight =
                typeof cfg.minScroll === 'number'
                    ? Math.max(cfg.minScroll, 120)
                    : nonCaptionMinHeight;
            const nonCaptionBase = Math.max(
                viewportHeight * baseFactor,
                minHeight
            );
            const explicitExtra = Math.max(cfg.extraScroll ?? 0, 0);
            return nonCaptionBase + explicitExtra;
        }
        const captionHeight =
            captionIndex >= 0 ? getCaptionNodeHeight(container, captionIndex) : 0;
        const explicitExtra = Math.max(cfg.extraScroll ?? 0, 0);
        return base + captionHeight + explicitExtra;
    };

    const setStepHeightsForGallery = (steps, config, container) => {
        if (!Array.isArray(steps) || steps.length === 0) {
            return;
        }
        steps.forEach((stepNode, index) => {
            const cfg =
                config[index] ||
                config[config.length - 1] ||
                null;
            const scrollHeight = computeStepScrollHeight(cfg, container);
            if (stepNode) {
                stepNode.style.height = `${scrollHeight}px`;
                stepNode.style.minHeight = `${scrollHeight}px`;
                stepNode.dataset.scrollHeight = String(scrollHeight);
            }
        });
    };

    const normalizeSplitEntry = (entry) => {
        if (!entry || typeof entry !== 'object') {
            return entry;
        }

        const normalized = { ...entry };

        normalized.captionSpeedFactor = normalized.captionSpeedFactor ?? 1;
        normalized.captionHoldAtTop = normalized.captionHoldAtTop ?? 0;
        normalized.captionStartDelay = normalized.captionStartDelay ?? 0;
        normalized.extraScroll = Math.max(normalized.extraScroll ?? 0, 0);

        const widthBase =
            typeof normalized.widthBase === 'number' && normalized.widthBase > 0
                ? normalized.widthBase
                : BASE_SPLIT_WIDTH;
        const heightBase =
            typeof normalized.heightBase === 'number' &&
            normalized.heightBase > 0
                ? normalized.heightBase
                : BASE_SPLIT_HEIGHT;

        normalized.widthBase = widthBase;
        normalized.heightBase = heightBase;

        if (typeof normalized.translateX === 'number') {
            normalized.translateXBase = normalized.translateX;
        }
        if (typeof normalized.top === 'number') {
            normalized.topBase = normalized.top;
        }
        if (typeof normalized.bottom === 'number') {
            normalized.bottomBase = normalized.bottom;
        }

        if (
            typeof normalized.captionOffset === 'number' &&
            normalized.captionOffsetFactor === undefined
        ) {
            normalized.captionOffsetFactor =
                normalized.captionOffset / heightBase;
            delete normalized.captionOffset;
        }

        if (normalized.applyWidthScale === false) {
            normalized.widthStrategy = 'fixed';
        } else if (typeof normalized.widthStrategy !== 'string') {
            normalized.widthStrategy = 'full';
        }

        if (normalized.applyHeightScale === false) {
            normalized.heightStrategy = 'fixed';
        } else if (typeof normalized.heightStrategy !== 'string') {
            normalized.heightStrategy = 'full';
        }

        if (
            normalized.widthStrategy !== 'fixed' &&
            !Array.isArray(normalized.widthClamp)
        ) {
            normalized.widthClamp =
                normalized.widthStrategy === 'clamp'
                    ? [0.5, 1.3]
                    : [0.35, 1.6];  // Wider range for better responsiveness
        }

        if (
            normalized.heightStrategy !== 'fixed' &&
            !Array.isArray(normalized.heightClamp)
        ) {
            normalized.heightClamp =
                normalized.heightStrategy === 'clamp'
                    ? [0.5, 1.35]
                    : [0.35, 1.5];  // Wider range for better responsiveness
        }

        delete normalized.applyWidthScale;
        delete normalized.applyHeightScale;

        return normalized;
    };
    const splitConfigsDesktop = [
        [
            { translateX: -520, scale: 1.3, top: 310, bottom: null, captionIndex: -1, duration: 800, ease: 'linear' },
            { translateX: 975, scale: 3.2, top: 50, bottom: null, captionIndex: 0, duration: 800, ease: 'linear' },
            { translateX: -640, scale: 2.9, top: 420, bottom: null, captionIndex: 1, duration: 800, ease: 'linear' },
            { translateX: -2092, scale: 2.7, top: 390, bottom: null, captionIndex: 2, duration: 800, ease: 'linear' },
            { translateX: -860, scale: 1, top: 270, bottom: null, captionIndex: -1, duration: 800, ease: 'linear' },
        ],
        [
            {
                translateX: -797,
                scale: 1.15,
                top: 170,
                bottom: null,
                captionIndex: 1,
                duration: 820,
                ease: 'linear',
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
            { translateX: -210, scale: 1.8, top: 230, bottom: null, captionIndex: -1, duration: 820, ease: 'linear' },
            { translateX: -617, scale: 2.8, top: 260, bottom: null, captionIndex: 0, duration: 820, ease: 'linear' },
            {
                translateX: -1745,
                scale: 2.2,
                top: 340,
                bottom: null,
                captionIndex: 2,
                duration: 820,
                ease: 'linear',
                captionOffsetFactor: -0.42,
                captionSpeedFactor: 1.2,
                captionHoldAtTop: 0.2,
                captionFadeWindow: 0.08,
                captionExtraFactor: 0,
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
            {
                translateX: -4522,
                scale: 5.5,
                top: -10,
                bottom: null,
                captionIndex: 3,
                duration: 820,
                ease: 'linear',
                captionOffsetFactor: -0.48,
                captionSpeedFactor: 1.2,
                captionHoldAtTop: 0.2,
                captionFadeWindow: 0.08,
                captionExtraFactor: 0,
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
            {
                translateX: -850,
                scale: 1,
                top: 200,
                bottom: null,
                captionIndex: -1,
                duration: 820,
                ease: 'linear',
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
        ], 
        [ 
            { translateX: -350, scale: 1.6, top: 109, bottom: null, captionIndex: -1, duration: 520, ease: 'linear', topInverseScale: true },
            { translateX: 355, scale: 2.2, top: 260, bottom: null, captionIndex: 0, duration: 520, ease: 'linear', topInverseScale: true },
            { translateX: -1544, scale: 2.6, top: 185, bottom: null, captionIndex: 1, duration: 520, ease: 'linear', topBreakpoints: [
                { width: 1920, top: 185 },
                { width: 1880, top: 132 },
                { width: 1810, top: 148 },
                { width: 1740, top: 175 },
                { width: 1620, top: 220 },
                { width: 1420, top: 300 },
            ] },
            { translateX: -840, scale: 0.95, top: 200, bottom: null, captionIndex: -1, duration: 520, ease: 'linear', topInverseScale: true },
        ],
    ]; 
    const rawSplitConfigsLandscapeMobile = [
        [
            { translateX: 130, scale: 1.25, top: 130, bottom: null, captionIndex: -1, duration: 720, ease: 'linear', captionOffsetFactor: -0.132, applyWidthScale: false, applyViewportScale: false },
            { translateX: 935, scale: 3.15, top: -27, bottom: null, captionIndex: 0, duration: 720, ease: 'linear', captionOffsetFactor: -0.132, applyWidthScale: false, applyViewportScale: false, applyHeightScale: false },
            { translateX: 120, scale: 3, top: 140, bottom: null, captionIndex: 1, duration: 720, ease: 'linear', captionOffsetFactor: -0.132, applyWidthScale: false, applyViewportScale: false, applyHeightScale: false },
            {
                translateX: -620,
                scale: 3,
                top: 160,
                bottom: null,
                captionIndex: 2,
                duration: 760,
                ease: 'linear',
                captionOffsetFactor: 0,
                captionSpeedFactor: 1,
                captionHoldAtTop: 0,
                captionFadeWindow: 0.08,
                captionExtraFactor: 0,
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
            {
                translateX: -10,
                scale: 0.9,
                top: 110,
                bottom: null,
                captionIndex: -1,
                duration: 680,
                ease: 'linear',
                applyWidthScale: false,
                applyViewportScale: false, 
                applyHeightScale: false,
            },
        ],
        [
            {
                translateX: 35,
                scale: 1,
                top: 45,
                bottom: null,
                captionIndex: -1,
                duration: 460,
                ease: 'linear',
                captionOffsetFactor: -0.121,
                captionHoldAtTop: 0,
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
                extraScroll: 100,
                minScroll: 360,
            },
            {
                translateX: 415,
                scale: 2.5,
                top: 160,
                bottom: null,
                captionIndex: 0,
                duration: 460,
                ease: 'linear',
                captionOffsetFactor: -0.121,
                captionHoldAtTop: 0,
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
                extraScroll: 160,
            },
            {
                translateX: 125,
                scale: 3.1,
                top: 80,
                bottom: null,
                captionIndex: 1,
                duration: 820,
                ease: 'linear',
                captionHoldAtTop: 0,
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
                extraScroll: 200,
            },
            { 
                translateX: -375,
                scale: 2.3,
                top: 130,
                bottom: null,
                captionIndex: 2,
                duration: 820,
                ease: 'linear',
                captionOffsetFactor: 0,
                captionSpeedFactor: 1,
                captionHoldAtTop: 0,
                captionFadeWindow: 0.08,
                captionExtraFactor: 0,
                extraScroll: 220,
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
            {
                translateX: -1650,
                scale: 5,
                top: -38,
                bottom: null,
                captionIndex: 3,
                duration: 820,
                ease: 'linear',
                captionOffsetFactor: 0,
                captionSpeedFactor: 1,
                captionHoldAtTop: 0,
                captionFadeWindow: 0.08,
                captionExtraFactor: 0,
                extraScroll: 240,
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
            {
                translateX: 4,
                scale: 0.9,
                top: 30,
                bottom: null,
                captionIndex: -1,
                duration: 820,
                ease: 'linear',
                captionHoldAtTop: 0,
                extraScroll: 120,
                minScroll: 360,
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
        ],
        [ 
            {
                translateX: 255,
                scale: 1.5,
                top: 50,
                bottom: null,
                captionIndex: -1,
                duration: 520,
                ease: 'linear',
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
            {
                translateX: 510,
                scale: 1.9,
                top: 100,
                bottom: null,
                captionIndex: 0,
                duration: 520,
                ease: 'linear',
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
            {
                translateX: -390,
                scale: 2.4,
                top: 55,
                bottom: null,
                captionIndex: 1,
                duration: 520,
                ease: 'linear',
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
            {
                translateX: 10,
                scale: 0.9,
                top: 60,
                bottom: null,
                captionIndex: -1,
                duration: 520,
                ease: 'linear',
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
        ],
    ];
    // Ensure landscape mobile configs scale relative to a common viewport size.
    // Based on typical mobile landscape dimensions (e.g., iPhone 14 Pro)
    const MOBILE_LANDSCAPE_BASE_WIDTH = 844;
    const MOBILE_LANDSCAPE_BASE_HEIGHT = 390;
    // Wider clamp ranges to support various tablet/phone landscape sizes
    const MOBILE_LANDSCAPE_WIDTH_CLAMP = [0.35, 1.5];
    const MOBILE_LANDSCAPE_HEIGHT_CLAMP = [0.35, 1.5];
    const mapLandscapeMobileEntry = (entry) => {
        if (!entry || typeof entry !== 'object') {
            return entry;
        }

        const sanitized = { ...entry };
        delete sanitized.applyWidthScale;
        delete sanitized.applyHeightScale;

        if (typeof sanitized.widthBase !== 'number') {
            sanitized.widthBase = MOBILE_LANDSCAPE_BASE_WIDTH;
        }
        if (typeof sanitized.heightBase !== 'number') {
            sanitized.heightBase = MOBILE_LANDSCAPE_BASE_HEIGHT;
        }
        if (!Array.isArray(sanitized.widthClamp)) {
            sanitized.widthClamp = MOBILE_LANDSCAPE_WIDTH_CLAMP;
        }
        if (!Array.isArray(sanitized.heightClamp)) {
            sanitized.heightClamp = MOBILE_LANDSCAPE_HEIGHT_CLAMP;
        }
        if (typeof sanitized.widthStrategy !== 'string') {
            sanitized.widthStrategy = 'clamp';
        }
        if (typeof sanitized.heightStrategy !== 'string') {
            sanitized.heightStrategy = 'clamp';
        }

        return sanitized;
    };
    const splitConfigsLandscapeMobile = rawSplitConfigsLandscapeMobile.map((group) =>
        Array.isArray(group) ? group.map(mapLandscapeMobileEntry) : group
    );
    
    // Medium screen configs (for screens 961px - 1368px width)
    // Based on 1368x768 reference dimensions - scaled from desktop configs
    const MEDIUM_SCREEN_BASE_WIDTH = 1368;
    const MEDIUM_SCREEN_BASE_HEIGHT = 768;
    const mapMediumScreenEntry = (entry) => {
        if (!entry || typeof entry !== 'object') return entry;
        const scaled = { ...entry };
        // Scale desktop values down to medium screen proportions
        const widthScale = MEDIUM_SCREEN_BASE_WIDTH / BASE_SPLIT_WIDTH; // 1368/1920 = 0.7125
        const heightScale = MEDIUM_SCREEN_BASE_HEIGHT / BASE_SPLIT_HEIGHT; // 768/911 = 0.843
        
        if (typeof scaled.translateX === 'number') {
            scaled.translateX = Math.round(scaled.translateX * widthScale);
        }
        // Don't pre-scale top if topInverseScale or topBreakpoints is set - let runtime handle it
        if (typeof scaled.top === 'number' && !scaled.topInverseScale && !Array.isArray(scaled.topBreakpoints)) {
            scaled.top = Math.round(scaled.top * heightScale);
        }
        if (typeof scaled.bottom === 'number') {
            scaled.bottom = Math.round(scaled.bottom * heightScale);
        }
        // Reduce extreme scale values for medium screens
        if (typeof scaled.scale === 'number' && scaled.scale > 2) {
            scaled.scale = scaled.scale * 0.85;
        }
        
        scaled.widthBase = MEDIUM_SCREEN_BASE_WIDTH;
        scaled.heightBase = MEDIUM_SCREEN_BASE_HEIGHT;
        scaled.widthStrategy = 'clamp';
        scaled.heightStrategy = 'clamp';
        scaled.widthClamp = [0.7, 1.15];
        scaled.heightClamp = [0.7, 1.15];
        
        return scaled;
    };
    const splitConfigsMediumScreen = splitConfigsDesktop.map((group) =>
        Array.isArray(group) ? group.map(mapMediumScreenEntry) : group
    );
    
    // Select appropriate config based on screen size
    const selectSplitConfigs = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w <= 960 && h <= 620) {
            return splitConfigsLandscapeMobile;
        } else if (w <= 1368) {
            return splitConfigsMediumScreen;
        }
        return splitConfigsDesktop;
    };
    
    const splitConfigs = selectSplitConfigs();
    const splitGalleries = Array.from(document.querySelectorAll('.split-gallery')).map((gallery, index) => {
        const container = gallery.querySelector('.split-image-container');
        const steps = Array.from(gallery.querySelectorAll('.split-step'));
        const rawConfig = splitConfigs[index] || splitConfigs[splitConfigs.length - 1];
        const config = rawConfig.map((cfg) => normalizeSplitEntry(cfg));
        setStepHeightsForGallery(steps, config, container);
        return {
            gallery,
            container,
            steps,
            config,
            measurements: null,
        };
    });

    const applyStepHeights = () => {
        splitGalleries.forEach(({ steps, config, container }) => {
            setStepHeightsForGallery(steps, config, container);
        });
    };
    const orientationOverlay = document.querySelector('.orientation-overlay') || null;
    const pageContent = document.querySelector('body') || null;
    const mainSections = document.querySelectorAll('main, section');
    const updateOrientationState = () => {
        const isPortrait = (window.matchMedia('(orientation: portrait)').matches);

        if (pageContent) {
            pageContent.classList.toggle('is-portrait', isPortrait);
        }

        mainSections.forEach((node) => {
            node.classList.toggle('orientation-hidden', isPortrait);
        });

        if (orientationOverlay) {
            orientationOverlay.setAttribute(
                'aria-hidden',
                isPortrait ? 'false' : 'true'
            );
        }
    };

    updateOrientationState();
    const scrollGalleries = Array.from(
        document.querySelectorAll('.scroll-gallery')
    ).map((gallery) => {
        const images = Array.from(
            gallery.querySelectorAll('.image-display img')
        );
        const spacer = gallery.querySelector('.scroll-spacer');
        const toFiniteNumber = (value) => {
            if (value === undefined || value === null || value === '') {
                return null;
            }
            const parsed = Number.parseFloat(value);
            return Number.isFinite(parsed) ? parsed : null;
        };
        const clampNumber = (value, min, max) =>
            Math.min(Math.max(value, min), max);

        const transitionMultiplierRaw = toFiniteNumber(
            gallery.dataset.transitionMultiplier
        );
        const transitionMultiplier =
            transitionMultiplierRaw !== null
                ? clampNumber(transitionMultiplierRaw, 0.3, 3)
                : 1;
        const tailMultiplierRaw = toFiniteNumber(
            gallery.dataset.tailMultiplier
        );
        const tailMultiplier =
            tailMultiplierRaw !== null
                ? clampNumber(tailMultiplierRaw, 0.3, 3)
                : 1;
        const transitionOverride = toFiniteNumber(
            gallery.dataset.transitionDistance
        );
        const tailExtraRaw = toFiniteNumber(gallery.dataset.tailExtra);
        const tailExtra =
            tailExtraRaw !== null ? Math.max(tailExtraRaw, 0) : 0;

        return {
            gallery,
            images,
            spacer,
            transitionMultiplier,
            tailMultiplier,
            transitionOverride,
            tailExtra,
        };
    });
    const pairedGalleries = Array.from(document.querySelectorAll('.paired-gallery')).map((section) => {
        const display = section.querySelector('.paired-display');
        const leftColumn = display?.querySelector('[data-stack="left"]') ?? null;
        const rightColumn = display?.querySelector('[data-stack="right"]') ?? null;
        const leftItems = leftColumn ? Array.from(leftColumn.querySelectorAll('img')) : [];
        const rightItems = rightColumn ? Array.from(rightColumn.querySelectorAll('img')) : [];
        const spacer = section.querySelector('.paired-scroll-spacer');

        leftItems.forEach((img, index) => {
            img.style.opacity = index === 0 ? '1' : '0';
            img.style.zIndex = String(leftItems.length - index);
            img.dataset.opacity = index === 0 ? '1' : '0';
        });

        rightItems.forEach((img, index) => {
            img.style.opacity = index === 0 ? '1' : '0';
            img.style.zIndex = String(rightItems.length - index);
            img.dataset.opacity = index === 0 ? '1' : '0';
        });

        return {
            section,
            display,
            leftColumn,
            rightColumn,
            leftItems,
            rightItems,
            spacer,
            measurements: null,
            headPadding: 0,
            tailPadding: 0,
            totalScroll: 0,
            leftTotal: 0,
            rightTotal: 0,
        };
    });
    const sec7Gallery = document.querySelector('.scroll-gallery.sec-7') || null;
    const sec7Footer = sec7Gallery?.querySelector('.section-bottom') || null;
    const iosSafeAreaBottom =
        typeof window !== 'undefined'
            ? parseInt(
                  getComputedStyle(document.documentElement).getPropertyValue(
                      'env(safe-area-inset-bottom)'
                  ) || '0',
                  10
              ) || 0
            : 0;


    const hasSplitGalleries = splitGalleries.some(
        (entry) => entry.container && entry.steps.length > 0
    );
    const hasScrollGalleries = scrollGalleries.some(
        (entry) => entry.images.length > 0 && entry.spacer
    );

    if (
        !hasScrollGalleries &&
        !hasSplitGalleries &&
        pairedGalleries.length === 0
    ) {
        return;
    }

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const computeRightColumnState = (count, scrollValue, distance) => {
        const opacities = new Array(count).fill(0);

        if (count <= 0) {
            return { opacities, activeIndex: -1 };
        }

        if (count === 1 || scrollValue <= 0) {
            opacities[0] = 1;
            return { opacities, activeIndex: 0 };
        }

        const safeDistance = Math.max(distance, 1);
        const progress = clamp(scrollValue / safeDistance, 0, 1);
        const baseIndex = 0;
        const nextIndex = Math.min(1, count - 1);

        if (nextIndex === baseIndex) {
            opacities[baseIndex] = 1;
            return { opacities, activeIndex: baseIndex };
        }

        const nextOpacity = clamp(progress, 0, 1);

        opacities[nextIndex] = nextOpacity;
        opacities[baseIndex] = 1;

        for (let i = 2; i < count; i += 1) {
            opacities[i] = 0;
        }

        const activeIndex = nextOpacity >= 0.6 ? nextIndex : baseIndex;

        return { opacities, activeIndex };
    };

    const computeColumnState = (count, scrollValue, distance, holdDelays = []) => {
        const opacities = new Array(count).fill(0);
        const releaseThreshold = 0.985;

        if (count <= 0) {
            return { opacities, activeIndex: -1 };
        }

        if (count === 1 || scrollValue <= 0) {
            opacities[0] = 1;
            return { opacities, activeIndex: 0 };
        }

        const safeDistance = Math.max(distance, 1);
        const normalized = clamp(scrollValue / safeDistance, 0, count - 1 + 0.001);
        const stageIndex = Math.floor(normalized);
        const blend = normalized - stageIndex;
        const currentIndex = Math.min(stageIndex, count - 1);
        const nextIndex = Math.min(stageIndex + 1, count - 1);

        let activeIndex = currentIndex;
        let currentOpacity = 1;
        let nextOpacity = 0;

        if (currentIndex === nextIndex) {
            opacities[currentIndex] = 1;
            return { opacities, activeIndex: currentIndex };
        }

        const hold = clamp(holdDelays[currentIndex] ?? 0, 0, 0.95);
        const adjustedBlend =
            hold >= 0.95
                ? 0
                : clamp((blend - hold) / Math.max(1 - hold, 0.0001), 0, 1);

        if (adjustedBlend >= releaseThreshold) {
            currentOpacity = 1;
            nextOpacity = 1;
            activeIndex = nextIndex;
        } else {
            nextOpacity = clamp(adjustedBlend / releaseThreshold, 0, 1);
            activeIndex = nextOpacity >= 0.5 ? nextIndex : currentIndex;
        }

        opacities[currentIndex] = currentOpacity;
        opacities[nextIndex] = nextOpacity;

        return { opacities, activeIndex };
    };
    const computeOpacity = (index, localScroll, distance) => {
        if (index === 0) {
            return 1;
        }

        const stepDistance = distance ?? transitionDistance;
        const fadeInStart = (index - 1) * stepDistance;
        const fadeInEnd = index * stepDistance;

        if (localScroll <= fadeInStart) {
            return 0;
        }

        if (localScroll >= fadeInEnd) {
            return 1;
        }

        const progress = (localScroll - fadeInStart) / stepDistance;
        return clamp(progress, 0, 1);
    };

    const syncScrollSpacers = () => {
        const viewportHeight = window.innerHeight || 0;
        scrollGalleries.forEach((entry, galleryIndex) => {
            const {
                images,
                spacer,
                transitionMultiplier = 1,
                tailMultiplier = 1,
                transitionOverride,
                tailExtra = 0,
            } = entry;
            if (!spacer || images.length === 0) {
                return;
            }

            const transitions = Math.max(images.length - 1, 0);
            const baseTransition =
                transitionOverride !== null && Number.isFinite(transitionOverride)
                    ? transitionOverride
                    : transitionDistance;
            const multiplier = Math.max(transitionMultiplier, 0.3);
            const effectiveDistance = Math.min(
                Math.max(baseTransition * multiplier, 40),
                1200
            );
            const totalScroll = effectiveDistance * transitions;
            const baseTail = Math.max(
                viewportHeight * 0.5,
                effectiveDistance * tailPaddingFactor
            );
            const tailBase = Math.min(
                Math.max(baseTail * Math.max(tailMultiplier, 0.3), 0),
                2000
            );
            const isLastGallery = galleryIndex === scrollGalleries.length - 1;
            const lastGalleryPadding = Math.max(
                viewportHeight * Math.max(tailMultiplier, 1) + iosSafeAreaBottom,
                tailBase + iosSafeAreaBottom
            );
            const tailPadding =
                (isLastGallery ? lastGalleryPadding : tailBase) + Math.max(tailExtra, 0);

            spacer.style.height = `${totalScroll + tailPadding}px`;
            entry.transitionDistancePx = effectiveDistance;
            entry.totalScrollPx = totalScroll;
            entry.tailPaddingPx = tailPadding;
        });
    };

    const syncPairedSpacers = () => {
        pairedGalleries.forEach((gallery) => {
            const { spacer, leftItems, rightItems } = gallery;
            if (!spacer) {
                return;
            }

            const leftTransitions = Math.max(leftItems.length - 1, 0);
            const rightTransitions = Math.max(rightItems.length - 1, 0);
            const transitions = leftTransitions + rightTransitions;
            const headPadding = Math.max(
                (window.innerHeight || 0) * pairedHeadPaddingFactor,
                160
            );
            const tailPadding = Math.max(
                (window.innerHeight || 0) * pairedTailPaddingFactor,
                260
            );
            const totalScroll = pairedTransitionDistance * transitions;
            const spacerHeight = headPadding + totalScroll + tailPadding;

            spacer.style.height = `${spacerHeight}px`;
            gallery.headPadding = headPadding;
            gallery.tailPadding = tailPadding;
            gallery.totalScroll = totalScroll;
            gallery.leftTotal = pairedTransitionDistance * leftTransitions;
            gallery.rightTotal = pairedTransitionDistance * rightTransitions;

            leftItems.forEach((img, index) => {
                img.style.zIndex = String(index + 1);
            });

            rightItems.forEach((img, index) => {
                const base = rightItems.length + index + 1;
                img.style.zIndex = String(base);
            });
        });
    };

    const updateSplitMeasurements = () => {
        splitGalleries.forEach((entry) => {
            const { gallery, container, steps, config } = entry;
            if (!gallery || !container || steps.length === 0) {
                entry.measurements = null;
            return;
        }

        const offsets = [];
        let accumulator = 0;

            steps.forEach((step, stepIndex) => {
            const cfg =
                config[stepIndex] ||
                config[config.length - 1] ||
                null;
            const datasetHeight = parseFloat(step?.dataset?.scrollHeight || '0');
            const computedHeight = computeStepScrollHeight(cfg, container);
            const height = Math.max(
                datasetHeight,
                computedHeight,
                step.offsetHeight,
                window.innerHeight * 0.7
            );
            offsets.push({
                start: accumulator,
                end: accumulator + height,
                duration: height,
                isLast: stepIndex === steps.length - 1,
            });
            accumulator += height;
        });

            entry.measurements = {
                start: gallery.offsetTop,
            total: accumulator,
            offsets,
        };
        });
    };

    const updatePairedMeasurements = () => {
        pairedGalleries.forEach((gallery) => {
            const sectionTop = gallery.section?.offsetTop ?? 0;
            const sectionHeight = gallery.section?.offsetHeight ?? 0;
            const displayHeight =
                gallery.display?.offsetHeight ?? window.innerHeight ?? 0;

            gallery.measurements = { 
                start: sectionTop,
                height: sectionHeight,
                displayHeight,
            };
        });
    };

    const BASE_VIEWPORT_WIDTH = 1920;
    const BASE_VIEWPORT_HEIGHT = 911;

    // Get viewport scale factors for responsive positioning
    // These factors are used to proportionally scale positions from design (1920x911) to current viewport
    const getViewportScaleFactors = () => {
        const currentWidth = window.innerWidth || BASE_VIEWPORT_WIDTH;
        const currentHeight = window.innerHeight || BASE_VIEWPORT_HEIGHT;
        
        // Direct ratios - how much smaller/larger current viewport is vs design
        const widthRatio = currentWidth / BASE_VIEWPORT_WIDTH;
        const heightRatio = currentHeight / BASE_VIEWPORT_HEIGHT;
        
        // Combined factor for uniform scaling
        const combinedFactor = Math.min(widthRatio, heightRatio);
        
        return {
            // Raw ratios for direct proportional scaling
            widthRatio,
            heightRatio,
            combinedFactor,
            // Current viewport dimensions
            currentWidth,
            currentHeight,
        };
    };

    // Legacy function for backward compatibility
    const getViewportScaleFactor = () => {
        const { combinedFactor } = getViewportScaleFactors();
        return clamp(combinedFactor, 0.4, 1.2);
    };

    const applySplitTransform = (scrollY) => { 
        splitGalleries.forEach((entry, index) => {
            const { container, measurements, config } = entry;
            if (!container || !measurements) {
            return;
        }

            const { start, total, offsets } = measurements; 
        if (total === 0) {
            return;
        }

        const captionBaseBottom = getCaptionBaseBottom();
        const totalWithExtra = total;
        const relative = clamp(scrollY - start, 0, totalWithExtra);

        let segmentIndex = 0; 

        for (let i = 0; i < offsets.length; i += 1) {
            const segment = offsets[i];

            if (relative >= segment.end) {
                segmentIndex = Math.min(i + 1, offsets.length - 1);
                continue;
            }

            segmentIndex = i;
            break;
        }

            const current = config[segmentIndex] || config[config.length - 1];
        const segment = offsets[Math.min(segmentIndex, offsets.length - 1)];
        let segmentProgress = 0;
        
            // Use the config's reference dimensions for base calculations
            // This ensures each config set scales from its own design reference
            const widthBase = current.widthBase || BASE_SPLIT_WIDTH;
            const heightBase = current.heightBase || BASE_SPLIT_HEIGHT;
            
            // Calculate ratios based on viewport vs CONFIG's design dimensions
            // Desktop configs use 1920x911, medium configs use 1368x768, mobile use 844x390
            const currentViewportWidth = window.innerWidth || widthBase;
            const currentViewportHeight = window.innerHeight || heightBase;
            const widthRatio = currentViewportWidth / widthBase;
            const heightRatio = currentViewportHeight / heightBase;

        if (segment && segment.duration) {
            const relativeWithinSegment = clamp(
                relative - segment.start,
                0,
                segment.duration
            );
            segmentProgress =
                segment.duration > 0 ? relativeWithinSegment / segment.duration : 0;
        } else {
            segmentProgress = 1;
        }

        // Calculate scale with viewport adjustment
        // Scale should be adjusted proportionally on different screen sizes
        let scale = current.scale ?? 1;
        const shouldApplyViewportScale =
            typeof current.applyViewportScale === 'boolean'
                ? current.applyViewportScale
                : true;
        
        // Use config-relative combined factor for scale adjustment
        const configCombinedFactor = Math.min(widthRatio, heightRatio);
        
        if (shouldApplyViewportScale && configCombinedFactor !== 1) {
            // Apply proportional scale adjustment relative to config's base
            // Formula: keeps ~90% of original at half-size, ~100% at design size
            const scaleAdjustment = 0.8 + configCombinedFactor * 0.2;
            scale *= scaleAdjustment;
        }
        
        // Calculate translateX - ALWAYS scale proportionally by width ratio
        // This ensures horizontal positioning maintains the same relative position
        let translateX;
        if (typeof current.translateXBase === 'number') {
            translateX = current.translateXBase * widthRatio;
        } else if (typeof current.translateX === 'number') {
            translateX = current.translateX * widthRatio;
        } else if (typeof current.translateX === 'string') {
            translateX = current.translateX;
        } else {
            translateX = 0;
        }

        // Calculate topOffset
        // If topBreakpoints is provided, interpolate between defined values
        // Otherwise use standard scaling or inverse scaling
        let topOffset;
        const useInverseTopScale = current.topInverseScale === true;
        const topBreakpoints = current.topBreakpoints;
        
        if (Array.isArray(topBreakpoints) && topBreakpoints.length >= 2) {
            // Use breakpoint interpolation for precise control
            const sorted = [...topBreakpoints].sort((a, b) => b.width - a.width);
            const viewportWidth = window.innerWidth || widthBase;
            
            // If width is larger than largest breakpoint
            if (viewportWidth >= sorted[0].width) {
                topOffset = sorted[0].top;
            }
            // If width is smaller than smallest breakpoint, extrapolate
            else if (viewportWidth <= sorted[sorted.length - 1].width) {
                const last = sorted[sorted.length - 1];
                const secondLast = sorted[sorted.length - 2];
                const slope = (last.top - secondLast.top) / (last.width - secondLast.width);
                topOffset = last.top + slope * (viewportWidth - last.width);
            }
            // Interpolate between breakpoints
            else {
                for (let i = 0; i < sorted.length - 1; i++) {
                    if (viewportWidth <= sorted[i].width && viewportWidth > sorted[i + 1].width) {
                        const upper = sorted[i];
                        const lower = sorted[i + 1];
                        const t = (viewportWidth - lower.width) / (upper.width - lower.width);
                        topOffset = lower.top + t * (upper.top - lower.top);
                        break;
                    }
                }
            }
        } else if (typeof current.topBase === 'number') {
            topOffset = useInverseTopScale 
                ? current.topBase * (2 - heightRatio) 
                : current.topBase * heightRatio;
        } else if (typeof current.top === 'number') {
            topOffset = useInverseTopScale 
                ? current.top * (2 - heightRatio) 
                : current.top * heightRatio;
        } else if (typeof current.top === 'string') {
            topOffset = current.top;
        } else {
            topOffset = 0;
        }

        // Calculate bottomOffset - ALWAYS scale proportionally by height ratio
        let bottomOffset;
        if (typeof current.bottomBase === 'number') {
            bottomOffset = current.bottomBase * heightRatio;
        } else if (typeof current.bottom === 'number') {
            bottomOffset = current.bottom * heightRatio;
        } else if (typeof current.bottom === 'string') {
            bottomOffset = current.bottom;
        } else {
            bottomOffset = null;
        }
        const durationMs = current.duration ?? 240; 
        const ease = current.ease ?? 'ease-out';

            const image = container.querySelector('.split-pan-image');
        if (image) {
            if (!image.dataset.activeSrc) {
                image.dataset.activeSrc = image.getAttribute('src') || '';
            }

            const targetSrc = current.src;
            if (typeof targetSrc === 'string' && targetSrc.length > 0 && image.dataset.activeSrc !== targetSrc) {
                image.setAttribute('src', targetSrc);
                image.dataset.activeSrc = targetSrc;
            }

            const transitionValue = `transform ${durationMs}ms ${ease}, top ${durationMs}ms ${ease}`;
            if (image.dataset.transitionValue !== transitionValue) {
                image.style.transition = transitionValue;
                image.dataset.transitionValue = transitionValue;
            }

            image.style.transformOrigin = '50% 50%';
            image.style.transform = `translateX(${translateX}px) scale(${scale})`;

            if (topOffset === null || topOffset === undefined) {
                image.style.top = '';
            } else if (typeof topOffset === 'string') {
                image.style.top = topOffset;
            } else {
                image.style.top = `${topOffset}px`;
            }

            if (bottomOffset === null || bottomOffset === undefined) {
                image.style.bottom = '';
            } else if (typeof bottomOffset === 'string') {
                image.style.bottom = bottomOffset;
            } else {
                image.style.bottom = `${bottomOffset}px`;
            }

            const captionNodes = container.querySelectorAll('.split-caption');
            const captionIndex = current.captionIndex ?? -1;

            const configuredCaptionOffset =
                (typeof current.captionOffset === 'number'
                    ? current.captionOffset
                    : 0) +
                (typeof current.captionOffsetFactor === 'number'
                    ? (window.innerHeight || BASE_SPLIT_HEIGHT) *
                      current.captionOffsetFactor
                    : 0);
            const defaultCaptionOffset = -50;

            captionNodes.forEach((captionNode) => {
                const isTarget =
                    Number(captionNode.dataset.caption) === captionIndex && captionIndex >= 0;
                captionNode.classList.toggle('is-active', isTarget);

                if (isTarget) {
                    const captionHeight = captionNode.offsetHeight || 0;
                    const viewportHeight = window.innerHeight || 0;
                    const travelDistance = Math.max(
                        viewportHeight - captionHeight - captionBaseBottom,
                        0
                    );

                    const captionOffset = configuredCaptionOffset || defaultCaptionOffset;

                    const clampedProgress = clamp(segmentProgress, 0, 1);
                    const overflowProgress = Math.max(segmentProgress - 1, 0);
                    const containerHeight =
                        container?.clientHeight ||
                        container?.getBoundingClientRect?.().height ||
                        viewportHeight;
                    const startBottom =
                        -(captionHeight || 0) - viewportHeight * 0.1;
                    const endBottom =
                        (containerHeight || viewportHeight || 0) +
                        (captionHeight || 0) * 0.2;
                    const baseBottomValue =
                        startBottom +
                        (endBottom - startBottom) * clampedProgress;

                    const overflowMultiplier =
                        Math.max(
                            (containerHeight || 0) + (captionHeight || 0),
                            (viewportHeight || 0) * 2,
                            1
                        );

                    const bottomValue =
                        baseBottomValue +
                        overflowProgress * overflowMultiplier;

                    const fadeInStart = 0.06;
                    const fadeInEnd = 0.24;
                    const fadeWindow = Math.max(fadeInEnd - fadeInStart, 0.0001);
                    let opacity = segmentProgress >= 1
                        ? 1
                        : clamp((segmentProgress - fadeInStart) / fadeWindow, 0, 1);

                    if (overflowProgress > 0) {
                        opacity = 1;
                    }

                    captionNode.style.bottom = `${bottomValue}px`;
                    captionNode.style.opacity = opacity.toFixed(3);
                    captionNode.style.visibility = opacity > 0.001 ? 'visible' : 'hidden';
                } else {
                    captionNode.style.opacity = '0';
                    captionNode.style.visibility = 'hidden';
                }
            });
        }
        });
    };

    applyStepHeights();
    syncScrollSpacers();
    syncPairedSpacers();
    updateSplitMeasurements();
    updatePairedMeasurements();

    let ticking = false;

    const render = () => {
        const scrollY = window.scrollY;
        const viewportHeight = window.innerHeight || 0;
        const scrollHeight = Math.max(
            document.documentElement?.scrollHeight || 0,
            document.body?.scrollHeight || 0
        );
        const reachedPageBottom = viewportHeight + scrollY >= scrollHeight - 1;

        scrollGalleries.forEach((entry, galleryIndex) => {
            const { gallery, images } = entry;
            if (images.length === 0 || !gallery) {
                return;
            }

            const galleryTop = gallery.offsetTop;
            const localScroll = Math.max(0, scrollY - galleryTop);
            const transitions = Math.max(images.length - 1, 0);
            const effectiveDistance =
                entry.transitionDistancePx || transitionDistance;
            const totalScroll =
                entry.totalScrollPx ?? effectiveDistance * transitions;
            const lastImageIndex = images.length - 1;
            const isLastGallery = galleryIndex === scrollGalleries.length - 1;
            const isSectionSeven = gallery.classList.contains('sec-7');
            const messageNode = isSectionSeven
                ? gallery.querySelector('.section-message')
                : null;
            const overlayNode = isSectionSeven
                ? gallery.querySelector('.section-overlay')
                : null;
            const hasMessageTarget =
                isSectionSeven && lastImageIndex >= 0 && messageNode;
            const hasOverlayTarget =
                isSectionSeven && lastImageIndex >= 0 && overlayNode;

            images.forEach((img, index) => {
                let opacity = computeOpacity(index, localScroll, effectiveDistance);

                if (transitions > 0 && index === lastImageIndex) {
                    const finalThreshold = Math.max(totalScroll - 1, totalScroll * 0.98);
                    if (localScroll >= finalThreshold || (isLastGallery && reachedPageBottom)) {
                        opacity = 1;
                    }
                }

                img.style.opacity = opacity.toFixed(3);

                if (hasMessageTarget && index === lastImageIndex) {
                    const reachedFullOpacity = opacity >= 0.999;
                    const fadeInStart = totalScroll;
                    const fadeInDuration = Math.max(
                        effectiveDistance * 0.6,
                        1
                    );
                    const rawProgress = reachedFullOpacity
                        ? (localScroll - fadeInStart) / fadeInDuration
                        : -1;
                    const clampedProgress = clamp(rawProgress, -0.02, 1);
                    const isVisible =
                        reachedFullOpacity && clampedProgress > 0;

                    messageNode.style.opacity = isVisible
                        ? clampedProgress.toFixed(3)
                        : '0';
                    messageNode.style.visibility = isVisible
                        ? 'visible'
                        : 'hidden';

                    if (isVisible) {
                        gallery.classList.add('is-message-active');
                    } else {
                        gallery.classList.remove('is-message-active');
                    }

                    if (hasOverlayTarget) {
                        const overlayDelay = 0.96;
                        const overlayProgress = clamp(
                            (clampedProgress - overlayDelay) /
                                Math.max(1 - overlayDelay, 0.0001),
                            0,
                            1
                        );
                        const overlayVisible = overlayProgress > 0;

                        if (overlayVisible) {
                            sec7Gallery.classList.add('is-overlay-active');
                            overlayNode.style.opacity =
                                overlayProgress.toFixed(3);
                            overlayNode.style.visibility = 'visible';
                            overlayNode.style.transform = `translate(-50%, ${(
                                (1 - overlayProgress) *
                                140
                            ).toFixed(3)}%)`;
                        } else {
                            overlayNode.style.opacity = '0';
                            overlayNode.style.visibility = 'hidden';
                            overlayNode.style.transform = 'translate(-50%, 160%)';
                            sec7Gallery.classList.remove('is-overlay-active');
                        }
                    }
                }
            });
        });

        if (sec7Gallery) {
            const galleryTop = sec7Gallery.offsetTop;
            const galleryHeight = sec7Gallery.offsetHeight;
            const galleryBottom = galleryTop + galleryHeight;
            const inSection =
                scrollY + viewportHeight > galleryTop && scrollY < galleryBottom;
            const exitDistance = Math.max(galleryTop - scrollY, 0);
            const hasExit = exitDistance > 0 && exitDistance < viewportHeight * 2;

            sec7Gallery.classList.toggle('is-active', inSection || hasExit);

            if (sec7Footer) {
                if (hasExit) {
                    const exitProgress = clamp(
                        exitDistance / Math.max(viewportHeight * 0.75, 1),
                        0,
                        1
                    );
                    const translateAmount = exitProgress * 140;
                    const opacityValue = clamp(1 - exitProgress * 1.35, 0, 1);

                    sec7Footer.style.transform = `translateY(${translateAmount.toFixed(
                        3
                    )}%)`;
                    sec7Footer.style.opacity = opacityValue.toFixed(3);
                } else if (inSection) {
                    sec7Footer.style.transform = 'translateY(0)';
                    sec7Footer.style.opacity = '1';
                } else {
                    sec7Footer.style.transform = '';
                    sec7Footer.style.opacity = '';
                }
            }
        }

        applySplitTransform(scrollY);

        pairedGalleries.forEach((gallery) => {
            const {
                leftItems,
                rightItems,
                measurements,
                headPadding = 0,
                totalScroll = 0,
                leftTotal = 0,
                rightTotal = 0,
            } = gallery;

            const hasLeft = Array.isArray(leftItems) && leftItems.length > 0;
            const hasRight = Array.isArray(rightItems) && rightItems.length > 0;

            if ((!hasLeft && !hasRight) || !measurements) { 
                return;
            }

            const { start, displayHeight = window.innerHeight || 0, height = 0 } = measurements;
            const relativeToSection = clamp(scrollY - start, 0, height);
            const triggerOffset = Math.max(displayHeight * pairedInitialOffsetFactor, 120);
            const rawProgress = Math.max(0, relativeToSection - triggerOffset);
            const sequenceScroll = clamp(
                Math.max(0, rawProgress - headPadding),
                0,
                totalScroll
            );

            const effectiveLeftTotal = Math.max(leftTotal, 0);
            const effectiveRightTotal = Math.max(rightTotal, 0);
            const leftScroll = Math.min(sequenceScroll, effectiveLeftTotal);
            const rightScroll =
                sequenceScroll > effectiveLeftTotal
                    ? Math.min(sequenceScroll - effectiveLeftTotal, effectiveRightTotal)
                    : 0;

            if (hasLeft) {
                const leftState = computeColumnState(
                    leftItems.length,
                    leftScroll,
                    pairedTransitionDistance,
                    leftTransitionHolds
                );

                leftItems.forEach((img, index) => {
                    const opacity = leftState.opacities[index] ?? 0;
                    const target = Number(opacity.toFixed(3));

                    if (!img.dataset.opacity) {
                        img.dataset.opacity = index === 0 ? '1' : '0';
                    }
                    const previous = Number(img.dataset.opacity);

                    if (target > previous) {
                        img.style.transition = `opacity ${pairedFadeDuration}ms ease-in-out`;
                    } else if (target < previous) {
                        img.style.transition = 'none';
                    }

                    img.style.opacity = target.toFixed(3);
                    img.classList.toggle('is-active', index === leftState.activeIndex);
                    img.style.visibility = target > 0.005 ? 'visible' : 'hidden';
                    img.dataset.opacity = target.toString();
                });
            }

            if (hasRight) { 
                const rightState = computeRightColumnState(
                    rightItems.length,
                    rightScroll,
                    pairedTransitionDistance
                );

                rightItems.forEach((img, index) => {
                    const opacity = rightState.opacities[index] ?? 0;
                    const target = Number(opacity.toFixed(3));

                    if (!img.dataset.opacity) {
                        img.dataset.opacity = index === 0 ? '1' : '0';
                    }
                    const previous = Number(img.dataset.opacity);

                    if (target > previous) {
                        img.style.transition = `opacity ${pairedFadeDuration}ms ease-in-out`;
                    } else if (target < previous) {
                        img.style.transition = 'none';
                    }

                    img.style.opacity = target.toFixed(3);
                    img.classList.toggle('is-active', index === rightState.activeIndex);
                    img.style.visibility = target > 0.005 ? 'visible' : 'hidden';
                    img.dataset.opacity = target.toString();
                });
            }
        });

        ticking = false;
    };

    const onScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(render);
            ticking = true;
        } 
    };

    // Track previous viewport dimensions for detecting significant changes
    let prevViewportWidth = window.innerWidth || BASE_SPLIT_WIDTH;
    let prevViewportHeight = window.innerHeight || BASE_SPLIT_HEIGHT;
    let prevConfigMode = 'desktop'; // Track which config set is active
    
    const getConfigMode = (w, h) => {
        if (w <= 960 && h <= 620) return 'mobile';
        if (w <= 1368) return 'medium';
        return 'desktop';
    };
    
    const handleResize = () => {
        const currentWidth = window.innerWidth || BASE_SPLIT_WIDTH;
        const currentHeight = window.innerHeight || BASE_SPLIT_HEIGHT;
        const currentConfigMode = getConfigMode(currentWidth, currentHeight);
        
        // Check if viewport changed significantly or config mode changed
        const widthChanged = Math.abs(currentWidth - prevViewportWidth) > 50;
        const heightChanged = Math.abs(currentHeight - prevViewportHeight) > 50;
        const modeChanged = currentConfigMode !== prevConfigMode;
        
        if (widthChanged || heightChanged || modeChanged) {
            prevViewportWidth = currentWidth;
            prevViewportHeight = currentHeight;
            prevConfigMode = currentConfigMode;
            
            // Select appropriate config based on new viewport
            let newConfigs;
            if (currentConfigMode === 'mobile') {
                newConfigs = splitConfigsLandscapeMobile;
            } else if (currentConfigMode === 'medium') {
                newConfigs = splitConfigsMediumScreen;
            } else {
                newConfigs = splitConfigsDesktop;
            }
            
            // Re-normalize and apply new configs
            splitGalleries.forEach((gallery, index) => {
                const rawConfig = newConfigs[index] || newConfigs[newConfigs.length - 1];
                gallery.config = rawConfig.map((cfg) => normalizeSplitEntry(cfg));
            });
        }
        
        setViewportHeightCSSVar();
        updateScrollSpacingSettings();
        applyStepHeights();
        syncScrollSpacers();
        syncPairedSpacers();
        updateSplitMeasurements();
        updatePairedMeasurements();
        updateOrientationState();
        render();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
        window.setTimeout(() => {
            setViewportHeightCSSVar();
            handleResize();
            updateOrientationState();
        }, 120);
    });
    window.addEventListener('load', () => {
        setViewportHeightCSSVar();
        updateScrollSpacingSettings();
        applyStepHeights();
        updateSplitMeasurements();
        updatePairedMeasurements();
        updateOrientationState();
        render();
    });
    render(); 
    
});
