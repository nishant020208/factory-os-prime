import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { gsap } from 'gsap';
import './TargetCursor.css';

// A position: fixed element is positioned relative to the viewport UNLESS an
// ancestor establishes a containing block (transform, perspective, filter,
// will-change of those, or contain). When that happens, the cursor's translate
// no longer maps to viewport coordinates, so we measure and compensate for it.
const getContainingBlock = element => {
  let node = element?.parentElement;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (
      style.transform !== 'none' ||
      style.perspective !== 'none' ||
      style.filter !== 'none' ||
      style.willChange.includes('transform') ||
      style.willChange.includes('perspective') ||
      style.willChange.includes('filter') ||
      /paint|layout|strict|content/.test(style.contain)
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
};

const getContainingBlockOffset = block => {
  if (!block) return { x: 0, y: 0 };
  const rect = block.getBoundingClientRect();
  return { x: rect.left + block.clientLeft, y: rect.top + block.clientTop };
};

const TargetCursor = ({
  targetSelector = '.cursor-target',
  spinDuration = 2,
  hideDefaultCursor = true,
  hoverDuration = 0.2,
  parallaxOn = true,
  cursorColor = '#ffffff',
  cursorColorOnTarget,
}) => {
  const cursorRef = useRef(null);
  const cornersRef = useRef(null);
  const spinTl = useRef(null);
  const dotRef = useRef(null);
  const containingBlockRef = useRef(null);

  // The cursor must not be part of the server-rendered HTML — it is a
  // client-only visual layer. Rendering it during SSR caused a hydration
  // mismatch (server: null, client: wrapper div) that threw on every page
  // load and could leave the tree in a broken state where clicks no longer
  // fired. Gate the render behind a mounted flag instead.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isActiveRef = useRef(false);
  const targetCornerPositionsRef = useRef(null);
  const tickerFnRef = useRef(null);
  const activeStrengthRef = useRef(0);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Robust mobile/touch detection — never show custom cursor on touch devices
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return true;
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 1024;
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const isMobileUserAgent = mobileRegex.test(userAgent.toLowerCase());
    // Also check CSS pointer: coarse (touchscreen)
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    return isCoarsePointer || isMobileUserAgent || (hasTouchScreen && isSmallScreen);
  }, []);

  const constants = useMemo(
    () => ({
      borderWidth: 3,
      cornerSize: 12,
    }),
    [],
  );

  const moveCursor = useCallback((x, y) => {
    if (!cursorRef.current) return;
    const { x: offsetX, y: offsetY } = getContainingBlockOffset(containingBlockRef.current);
    gsap.to(cursorRef.current, {
      x: x - offsetX,
      y: y - offsetY,
      duration: 0.1,
      ease: 'power3.out',
    });
  }, []);

  useEffect(() => {
    if (isMobile || !cursorRef.current) return;

    const originalCursor = document.body.style.cursor;
    if (hideDefaultCursor) {
      document.body.style.cursor = 'none';
    }

    const cursor = cursorRef.current;
    cornersRef.current = cursor.querySelectorAll('.target-cursor-corner');

    containingBlockRef.current = getContainingBlock(cursor);
    const getOffset = () => getContainingBlockOffset(containingBlockRef.current);

    let activeTarget = null;
    let currentLeaveHandler = null;
    let resumeTimeout = null;
    let leaveScheduled = false;
    let lastFrameRefresh = 0;

    const cleanupTarget = target => {
      if (currentLeaveHandler) {
        target.removeEventListener('mouseleave', currentLeaveHandler);
      }
      currentLeaveHandler = null;
    };

    const initialOffset = getOffset();
    gsap.set(cursor, {
      xPercent: -50,
      yPercent: -50,
      x: window.innerWidth / 2 - initialOffset.x,
      y: window.innerHeight / 2 - initialOffset.y,
    });

    const createSpinTimeline = () => {
      if (spinTl.current) {
        spinTl.current.kill();
      }
      spinTl.current = gsap
        .timeline({ repeat: -1 })
        .to(cursor, { rotation: '+=360', duration: spinDuration, ease: 'none' });
    };

    createSpinTimeline();

    // Find the innermost hoverable element (per targetSelector) that contains
    // the given node, mirroring the DOM walk used on real mouseover events.
    const findTarget = el => {
      let current = el;
      while (current && current !== document.body) {
        if (current.matches && current.matches(targetSelector)) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    };

    // Put the reticle into targeting mode around `target`: expand the corner
    // brackets to its box, pause the idle spin, color-shift, and register the
    // collapse handler that returns the cursor to its plain spinning state.
    const engageTarget = target => {
      if (!cursorRef.current || !cornersRef.current) return;
      if (activeTarget === target) {
        refreshFrameGeometry();
        return;
      }
      if (activeTarget) {
        cleanupTarget(activeTarget);
      }
      if (resumeTimeout) {
        clearTimeout(resumeTimeout);
        resumeTimeout = null;
      }

      activeTarget = target;
      const corners = Array.from(cornersRef.current);
      corners.forEach(corner => gsap.killTweensOf(corner, 'x,y'));

      gsap.killTweensOf(cursorRef.current, 'rotation');
      spinTl.current?.pause();
      gsap.set(cursorRef.current, { rotation: 0 });

      if (cursorColorOnTarget) {
        gsap.to(corners, {
          borderColor: cursorColorOnTarget,
          duration: 0.15,
          ease: 'power2.out',
        });
        if (dotRef.current) {
          gsap.to(dotRef.current, {
            backgroundColor: cursorColorOnTarget,
            duration: 0.15,
            ease: 'power2.out',
          });
        }
      }

      const rect = target.getBoundingClientRect();
      const { borderWidth, cornerSize } = constants;
      const { x: offsetX, y: offsetY } = getOffset();
      const cursorX = gsap.getProperty(cursorRef.current, 'x');
      const cursorY = gsap.getProperty(cursorRef.current, 'y');

      targetCornerPositionsRef.current = [
        { x: rect.left - borderWidth - offsetX, y: rect.top - borderWidth - offsetY },
        { x: rect.right + borderWidth - cornerSize - offsetX, y: rect.top - borderWidth - offsetY },
        { x: rect.right + borderWidth - cornerSize - offsetX, y: rect.bottom + borderWidth - cornerSize - offsetY },
        { x: rect.left - borderWidth - offsetX, y: rect.bottom + borderWidth - cornerSize - offsetY },
      ];

      isActiveRef.current = true;
      gsap.ticker.add(tickerFnRef.current);

      gsap.to(activeStrengthRef, {
        current: 1,
        duration: hoverDuration,
        ease: 'power2.out',
      });

      corners.forEach((corner, i) => {
        gsap.to(corner, {
          x: targetCornerPositionsRef.current[i].x - cursorX,
          y: targetCornerPositionsRef.current[i].y - cursorY,
          duration: 0.2,
          ease: 'power2.out',
        });
      });

      const leaveHandler = () => {
        gsap.ticker.remove(tickerFnRef.current);

        isActiveRef.current = false;
        targetCornerPositionsRef.current = null;
        gsap.set(activeStrengthRef, { current: 0, overwrite: true });
        activeTarget = null;

        if (cursorColorOnTarget && cornersRef.current) {
          gsap.to(Array.from(cornersRef.current), {
            borderColor: cursorColor,
            duration: 0.15,
            ease: 'power2.out',
          });
          if (dotRef.current) {
            gsap.to(dotRef.current, {
              backgroundColor: cursorColor,
              duration: 0.15,
              ease: 'power2.out',
            });
          }
        }

        if (cornersRef.current) {
          const idleCorners = Array.from(cornersRef.current);
          gsap.killTweensOf(idleCorners, 'x,y');
          const { cornerSize } = constants;
          const positions = [
            { x: -cornerSize * 1.5, y: -cornerSize * 1.5 },
            { x: cornerSize * 0.5, y: -cornerSize * 1.5 },
            { x: cornerSize * 0.5, y: cornerSize * 0.5 },
            { x: -cornerSize * 1.5, y: cornerSize * 0.5 },
          ];
          const tl = gsap.timeline();
          idleCorners.forEach((corner, index) => {
            tl.to(
              corner,
              {
                x: positions[index].x,
                y: positions[index].y,
                duration: 0.3,
                ease: 'power3.out',
              },
              0,
            );
          });
        }

        resumeTimeout = setTimeout(() => {
          if (!activeTarget && cursorRef.current && spinTl.current) {
            const currentRotation = gsap.getProperty(cursorRef.current, 'rotation');
            const normalizedRotation = currentRotation % 360;
            spinTl.current.kill();
            spinTl.current = gsap
              .timeline({ repeat: -1 })
              .to(cursorRef.current, { rotation: '+=360', duration: spinDuration, ease: 'none' });
            gsap.to(cursorRef.current, {
              rotation: normalizedRotation + 360,
              duration: spinDuration * (1 - normalizedRotation / 360),
              ease: 'none',
              onComplete: () => {
                spinTl.current?.restart();
              },
            });
          }
          resumeTimeout = null;
        }, 50);

        cleanupTarget(target);
      };

      currentLeaveHandler = leaveHandler;
      target.addEventListener('mouseleave', leaveHandler);
    };

    const scheduleLeave = () => {
      if (leaveScheduled) return;
      leaveScheduled = true;
      // Defer past the current tick so a collapse triggered from inside the
      // animation ticker (or from a click handler mid-flight) doesn't tear the
      // frame down while gsap is iterating. Re-probe before collapsing: if a
      // new (or the same) target now sits under the pointer, hand off to it;
      // only fold the frame when the pointer really sits on nothing hoverable.
      setTimeout(() => {
        leaveScheduled = false;
        if (!currentLeaveHandler) return;
        const probe = document.elementFromPoint(lastMouseRef.current.x, lastMouseRef.current.y);
        const underTarget = probe ? findTarget(probe) : null;
        if (activeTarget && underTarget && underTarget !== activeTarget) {
          engageTarget(underTarget);
        } else if (!underTarget) {
          currentLeaveHandler();
        }
      }, 0);
    };

    // Refresh the frame's corner anchors to the element's CURRENT box.
    const refreshFrameGeometry = () => {
      if (!activeTarget) return;
      const target = activeTarget;
      // A detached element keeps stale getBoundingClientRect values — if the
      // node was removed (navigation, dialog close, realtime re-render), fold
      // the frame back instead of pinning it to coordinates that no longer
      // exist on screen.
      if (!target.isConnected || target.offsetParent === null && getComputedStyle(target).display === 'none') {
        scheduleLeave();
        return false;
      }
      const rect = target.getBoundingClientRect();
      const { borderWidth, cornerSize } = constants;
      const { x: offsetX, y: offsetY } = getOffset();
      targetCornerPositionsRef.current = [
        { x: rect.left - borderWidth - offsetX, y: rect.top - borderWidth - offsetY },
        { x: rect.right + borderWidth - cornerSize - offsetX, y: rect.top - borderWidth - offsetY },
        { x: rect.right + borderWidth - cornerSize - offsetX, y: rect.bottom + borderWidth - cornerSize - offsetY },
        { x: rect.left - borderWidth - offsetX, y: rect.bottom + borderWidth - cornerSize - offsetY },
      ];
      return true;
    };

    const tickerFn = () => {
      if (!cursorRef.current || !cornersRef.current) return;
      if (!activeTarget) return;

      const strength = activeStrengthRef.current;
      if (strength === 0) return;

      // Throttled live tracking: re-measure the framed element's box every
      // ~100ms (not every frame) so layout shifts — font loads, async content,
      // hover scale transitions, scrolls inside containers, re-renders — never
      // leave the reticle floating at hover-enter coordinates. The corners
      // still glide smoothly because their tweens chase the refreshed targets.
      const now = performance.now();
      if (now - lastFrameRefresh > 100) {
        lastFrameRefresh = now;
        const target = activeTarget;
        const refreshOk = refreshFrameGeometry();
        if (!refreshOk) return;

        // If the pointer no longer sits on the framed element (it scrolled or
        // shifted out from under a stationary cursor), release the frame so
        // hover handling reframes whatever is under the pointer instead.
        const under = document.elementFromPoint(lastMouseRef.current.x, lastMouseRef.current.y);
        const stillOnTarget =
          !!under && (under === target || target.contains(under));
        if (!stillOnTarget) {
          scheduleLeave();
          return;
        }
      }

      const cursorX = gsap.getProperty(cursorRef.current, 'x');
      const cursorY = gsap.getProperty(cursorRef.current, 'y');

      const corners = Array.from(cornersRef.current);
      corners.forEach((corner, i) => {
        const currentX = gsap.getProperty(corner, 'x');
        const currentY = gsap.getProperty(corner, 'y');

        const targetX = targetCornerPositionsRef.current[i].x - cursorX;
        const targetY = targetCornerPositionsRef.current[i].y - cursorY;

        const finalX = currentX + (targetX - currentX) * strength;
        const finalY = currentY + (targetY - currentY) * strength;

        const duration = strength >= 0.99 ? (parallaxOn ? 0.2 : 0) : 0.05;

        gsap.to(corner, {
          x: finalX,
          y: finalY,
          duration: duration,
          ease: duration === 0 ? 'none' : 'power1.out',
          overwrite: 'auto',
        });
      });
    };

    tickerFnRef.current = tickerFn;

    const moveHandler = e => {
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      moveCursor(e.clientX, e.clientY);
    };
    window.addEventListener('mousemove', moveHandler);

    const scrollHandler = () => {
      if (!activeTarget || !cursorRef.current) return;
      const { x: offsetX, y: offsetY } = getOffset();
      const mouseX = gsap.getProperty(cursorRef.current, 'x') + offsetX;
      const mouseY = gsap.getProperty(cursorRef.current, 'y') + offsetY;
      const elementUnderMouse = document.elementFromPoint(mouseX, mouseY);
      const isStillOverTarget =
        elementUnderMouse &&
        (elementUnderMouse === activeTarget || elementUnderMouse.closest(targetSelector) === activeTarget);
      if (!isStillOverTarget) {
        if (currentLeaveHandler) {
          currentLeaveHandler();
        }
      }
    };
    window.addEventListener('scroll', scrollHandler, { passive: true });

    const mouseDownHandler = () => {
      if (!dotRef.current) return;
      gsap.to(dotRef.current, { scale: 0.7, duration: 0.3 });
      gsap.to(cursorRef.current, { scale: 0.9, duration: 0.2 });
    };

    const mouseUpHandler = () => {
      if (!dotRef.current) return;
      gsap.to(dotRef.current, { scale: 1, duration: 0.3 });
      gsap.to(cursorRef.current, { scale: 1, duration: 0.2 });
    };

    window.addEventListener('mousedown', mouseDownHandler);
    window.addEventListener('mouseup', mouseUpHandler);

    // After any click, verify the hovered element is still under the pointer.
    // Clicks routinely hide or replace the element that was hovered (opening a
    // dialog, closing a dropdown, navigating to another route), and a removed
    // element never fires mouseleave — which previously left the targeting
    // frame frozen on screen while the native cursor stayed hidden.
    const clickResetHandler = () => {
      setTimeout(() => {
        if (!activeTarget) return;
        const el = document.elementFromPoint(
          lastMouseRef.current.x,
          lastMouseRef.current.y,
        );
        const stillOverTarget =
          !!el && (el === activeTarget || activeTarget.contains(el));
        if (!stillOverTarget) {
          scheduleLeave();
        }
      }, 0);
    };
    window.addEventListener('click', clickResetHandler);

    const enterHandler = e => {
      const directTarget = e.target;
      const allTargets = [];
      let current = directTarget;
      while (current && current !== document.body) {
        if (current.matches && current.matches(targetSelector)) {
          allTargets.push(current);
        }
        current = current.parentElement;
      }
      const target = allTargets[0] || null;
      if (!target || !cursorRef.current || !cornersRef.current) {
        // Moving over a non-interactive region while a target frame is still
        // active means the previously hovered element was removed or covered
        // without a mouseleave (a click opened a dialog/menu or navigated).
        // Reset the stale frame so the reticle reverts to the plain cursor
        // instead of staying frozen in targeting mode with the OS cursor
        // hidden.
        if (activeTarget && currentLeaveHandler) {
          currentLeaveHandler();
        }
        return;
      }
      engageTarget(target);
    };

    window.addEventListener('mouseover', enterHandler, { passive: true });

    const resizeHandler = () => {
      containingBlockRef.current = getContainingBlock(cursor);
    };
    window.addEventListener('resize', resizeHandler);

    return () => {
      if (tickerFnRef.current) {
        gsap.ticker.remove(tickerFnRef.current);
      }

      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseover', enterHandler);
      window.removeEventListener('scroll', scrollHandler);
      window.removeEventListener('resize', resizeHandler);
      window.removeEventListener('mousedown', mouseDownHandler);
      window.removeEventListener('mouseup', mouseUpHandler);
      window.removeEventListener('click', clickResetHandler);

      if (activeTarget) {
        cleanupTarget(activeTarget);
      }

      spinTl.current?.kill();
      document.body.style.cursor = originalCursor;

      isActiveRef.current = false;
      targetCornerPositionsRef.current = null;
      activeStrengthRef.current = 0;
    };
  }, [
    targetSelector,
    spinDuration,
    moveCursor,
    constants,
    hideDefaultCursor,
    isMobile,
    hoverDuration,
    parallaxOn,
    cursorColor,
    cursorColorOnTarget,
    mounted,
  ]);

  useEffect(() => {
    if (isMobile || !cursorRef.current || !spinTl.current) return;
    if (spinTl.current.isActive()) {
      spinTl.current.kill();
      spinTl.current = gsap
        .timeline({ repeat: -1 })
        .to(cursorRef.current, { rotation: '+=360', duration: spinDuration, ease: 'none' });
    }
  }, [spinDuration, isMobile, mounted]);

  // Never render on mobile/touch — preserves normal scrolling & touch UX.
  // Also render nothing until the client has mounted (see mounted flag above).
  if (!mounted || isMobile) {
    return null;
  }

  return (
    <div ref={cursorRef} className="target-cursor-wrapper">
      <div ref={dotRef} className="target-cursor-dot" style={{ backgroundColor: cursorColor }} />
      <div className="target-cursor-corner corner-tl" style={{ borderColor: cursorColor }} />
      <div className="target-cursor-corner corner-tr" style={{ borderColor: cursorColor }} />
      <div className="target-cursor-corner corner-br" style={{ borderColor: cursorColor }} />
      <div className="target-cursor-corner corner-bl" style={{ borderColor: cursorColor }} />
    </div>
  );
};

export default TargetCursor;
