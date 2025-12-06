document.addEventListener('DOMContentLoaded', () => {
    const BASE_SPLIT_WIDTH = 1905;
    const BASE_SPLIT_HEIGHT = 910;
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
                    ? [0.85, 1.2]
                    : [0.7, 1.55];
        }

        if (
            normalized.heightStrategy !== 'fixed' &&
            !Array.isArray(normalized.heightClamp)
        ) {
            normalized.heightClamp =
                normalized.heightStrategy === 'clamp'
                    ? [0.85, 1.25]
                    : [0.7, 1.45];
        }

        delete normalized.applyWidthScale;
        delete normalized.applyHeightScale;

        return normalized;
    };
    const splitConfigsDesktop = [
        [
            { translateX: -520, scale: 1.3, top: 310, bottom: null, captionIndex: -1, duration: 800, ease: 'linear' },
            { translateX: 932, scale: 2.9, top: 50, bottom: null, captionIndex: 0, duration: 800, ease: 'linear' },
            { translateX: -550, scale: 2.7, top: 360, bottom: null, captionIndex: 1, duration: 800, ease: 'linear' },
            { translateX: -2092, scale: 2.55, top: 370, bottom: null, captionIndex: 2, duration: 800, ease: 'linear' },
            { translateX: -880, scale: 1, top: 270, bottom: null, captionIndex: -1, duration: 800, ease: 'linear' },
        ],
        [
            {
                translateX: -757,
                scale: 1,
                top: 190,
                bottom: null,
                captionIndex: 1,
                duration: 820,
                ease: 'linear',
                applyWidthScale: false,
                applyViewportScale: false,
                applyHeightScale: false,
            },
            { translateX: -260, scale: 1.6, top: 250, bottom: null, captionIndex: -1, duration: 820, ease: 'linear' },
            { translateX: -717, scale: 2.5, top: 220, bottom: null, captionIndex: 0, duration: 820, ease: 'linear' },
            {
                translateX: -1705,
                scale: 2.1,
                top: 350,
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
                top: -27,
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
            { translateX: -350, scale: 1.5, top: 109, bottom: null, captionIndex: -1, duration: 520, ease: 'linear' },
            { translateX: 355, scale: 2.2, top: 260, bottom: null, captionIndex: 0, duration: 520, ease: 'linear' },
            { translateX: -1544, scale: 2.4, top: 230, bottom: null, captionIndex: 1, duration: 520, ease: 'linear' },
            { translateX: -840, scale: 0.95, top: 200, bottom: null, captionIndex: -1, duration: 520, ease: 'linear' },
        ],
    ]; 
    const splitConfigsLandscapeMobile = [
        [
            { translateX: 200, scale: 1.3, top: 260, bottom: null, captionIndex: -1, duration: 720, ease: 'linear', captionOffsetFactor: -0.132, applyWidthScale: false, applyViewportScale: false },
            { translateX: 920, scale: 3, top: 15, bottom: null, captionIndex: 0, duration: 720, ease: 'linear', captionOffsetFactor: -0.132, applyWidthScale: false, applyViewportScale: false, applyHeightScale: false },
            { translateX: 105, scale: 2.6, top: 160, bottom: null, captionIndex: 1, duration: 720, ease: 'linear', captionOffsetFactor: -0.132, applyWidthScale: false, applyViewportScale: false, applyHeightScale: false },
            {
                translateX: -535,
                scale: 2.6,
                top: 168,
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
                translateX: 40,
                scale: 1,
                top: 120,
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
                translateX: 90,
                scale: 1.08,
                top: 60,
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
                translateX: 310,
                scale: 1.6,
                top: 90,
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
                translateX: 115,
                scale: 2.7,
                top: 100,
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
                translateX: -355,
                scale: 2.1,
                top: 80,
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
                translateX: -1540,
                scale: 5,
                top: -17,
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
                translateX: 40,
                scale: 0.9,
                top: 90,
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
            { translateX: 450, scale: 2, top: 150, bottom: null, captionIndex: -1, duration: 520, ease: 'linear' },
            { translateX: 1000, scale: 2.5, top: 200, bottom: null, captionIndex: 0, duration: 520, ease: 'linear' },
            { translateX: -300, scale: 2.6, top: 150, bottom: null, captionIndex: 1, duration: 520, ease: 'linear' },
            { translateX: 100, scale: 1.2, top: 200, bottom: null, captionIndex: -1, duration: 520, ease: 'linear' },
        ],
    ];
    const splitConfigs = window.innerWidth <= 960 && window.innerHeight <= 620
        ? splitConfigsLandscapeMobile
        : splitConfigsDesktop;
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
    const scrollGalleries = Array.from(document.querySelectorAll('.scroll-gallery')).map((gallery) => {
        const images = Array.from(gallery.querySelectorAll('.image-display img'));
        const spacer = gallery.querySelector('.scroll-spacer');
        return {
            gallery,
            images,
            spacer,
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
    const computeOpacity = (index, localScroll) => {
        if (index === 0) {
            return 1;
        }

        const fadeInStart = (index - 1) * transitionDistance;
        const fadeInEnd = index * transitionDistance;

        if (localScroll <= fadeInStart) {
            return 0;
        }

        if (localScroll >= fadeInEnd) {
            return 1;
        }

        const progress = (localScroll - fadeInStart) / transitionDistance;
        return clamp(progress, 0, 1);
    };

    const syncScrollSpacers = () => {
        scrollGalleries.forEach((entry, galleryIndex) => {
            const { images, spacer } = entry;
            if (!spacer || images.length === 0) {
            return;
        }

        const transitions = Math.max(images.length - 1, 0);
            const totalScroll = transitionDistance * transitions;
        const tailBase = Math.max(
            (window.innerHeight || 0) * 0.5,
            transitionDistance * tailPaddingFactor
        );
        const isLastGallery = galleryIndex === scrollGalleries.length - 1;
        const lastGalleryPadding = Math.max(
            (window.innerHeight || 0) + iosSafeAreaBottom,
            tailBase + iosSafeAreaBottom
        );
        const tailPadding = isLastGallery ? lastGalleryPadding : tailBase;
            spacer.style.height = `${totalScroll + tailPadding}px`;
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

    const getViewportScaleFactor = () => {
        const currentWidth = window.innerWidth || BASE_VIEWPORT_WIDTH;
        const currentHeight = window.innerHeight || BASE_VIEWPORT_HEIGHT;
        const widthRatio = clamp(currentWidth / BASE_VIEWPORT_WIDTH, 0.55, 1);
        const heightRatio = clamp(currentHeight / BASE_VIEWPORT_HEIGHT, 0.55, 1);
        return Math.min(widthRatio, heightRatio);
    };

    const applySplitTransform = (scrollY) => {
        const viewportScaleFactor = getViewportScaleFactor();
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
            const containerWidth =
                container.clientWidth ||
                container.getBoundingClientRect().width ||
                BASE_SPLIT_WIDTH;
            const containerHeight =
                container.clientHeight ||
                container.getBoundingClientRect().height ||
                BASE_SPLIT_HEIGHT;

            const widthBase = current.widthBase || BASE_SPLIT_WIDTH;
            const heightBase = current.heightBase || BASE_SPLIT_HEIGHT;
            const widthRatioRaw =
                widthBase > 0 ? containerWidth / widthBase : 1;
            const heightRatioRaw =
                heightBase > 0 ? containerHeight / heightBase : 1;

            const [minWidthClamp, maxWidthClamp] = Array.isArray(
                current.widthClamp
            )
                ? current.widthClamp
                : [0.7, 1.55];
            const [minHeightClamp, maxHeightClamp] = Array.isArray(
                current.heightClamp
            )
                ? current.heightClamp
                : [0.7, 1.45];

            const widthStrategy = current.widthStrategy || 'full';
            const heightStrategy = current.heightStrategy || 'full';

            const widthRatio =
                widthStrategy === 'fixed'
                    ? 1
                    : clamp(
                          widthRatioRaw,
                          minWidthClamp ?? 0.7,
                          maxWidthClamp ?? 1.55
                      );

            const heightRatio =
                heightStrategy === 'fixed'
                    ? 1
                    : clamp(
                          heightRatioRaw,
                          minHeightClamp ?? 0.7,
                          maxHeightClamp ?? 1.45
                      );

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

        let scale = current.scale ?? 1;
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

        let topOffset;
        if (typeof current.topBase === 'number') {
            topOffset = current.topBase * heightRatio;
        } else if (typeof current.top === 'number') {
            topOffset = current.top * heightRatio;
        } else if (typeof current.top === 'string') {
            topOffset = current.top;
        } else {
            topOffset = 0;
        }

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
        const shouldApplyViewportScale =
            typeof current.applyViewportScale === 'boolean'
                ? current.applyViewportScale
                : true;
        if (viewportScaleFactor < 0.999 && shouldApplyViewportScale) {
            const blend = 0.6 + viewportScaleFactor * 0.4;
            scale *= blend;
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
            const totalScroll = transitionDistance * transitions;
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
                let opacity = computeOpacity(index, localScroll);

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
                        transitionDistance * 0.6,
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

    const handleResize = () => {
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
