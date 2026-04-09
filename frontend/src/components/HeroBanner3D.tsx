import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import "../styles/components/hero-banner-3d.css";

const markers = Array.from({ length: 12 }, (_, index) => index);

export function HeroBanner3D() {
  const prefersReducedMotion = useReducedMotion();
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 });

  const rotateX = prefersReducedMotion ? 0 : pointerOffset.y * -10;
  const rotateY = prefersReducedMotion ? 0 : pointerOffset.x * 12;

  return (
    <div
      className="hero-banner-3d"
      onMouseLeave={() => setPointerOffset({ x: 0, y: 0 })}
      onMouseMove={(event) => {
        if (prefersReducedMotion) {
          return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        setPointerOffset({ x, y });
      }}
    >
      <div className="hero-banner-3d__noise" />
      <div className="hero-banner-3d__backdrop hero-banner-3d__backdrop--left" />
      <div className="hero-banner-3d__backdrop hero-banner-3d__backdrop--right" />
      <div className="hero-banner-3d__rail hero-banner-3d__rail--left" />
      <div className="hero-banner-3d__rail hero-banner-3d__rail--right" />
      <div className="hero-banner-3d__rule hero-banner-3d__rule--top" />
      <div className="hero-banner-3d__rule hero-banner-3d__rule--bottom" />
      <div className="hero-banner-3d__grid" />

      <div className="hero-banner-3d__ring hero-banner-3d__ring--outer" />
      <div className="hero-banner-3d__ring hero-banner-3d__ring--mid" />
      <div className="hero-banner-3d__ring hero-banner-3d__ring--inner" />
      <div className="hero-banner-3d__beam hero-banner-3d__beam--left" />
      <div className="hero-banner-3d__beam hero-banner-3d__beam--right" />

      <motion.div
        animate={
          prefersReducedMotion
            ? undefined
            : {
                rotateZ: [0, -1.8, 1.2, 0],
                y: [0, -10, 0],
              }
        }
        className="hero-banner-3d__watch-stage"
        transition={{
          duration: 9,
          ease: "easeInOut",
          repeat: Number.POSITIVE_INFINITY,
        }}
        style={{
          rotateX,
          rotateY,
        }}
      >
        <div className="hero-banner-3d__watch-shadow" />
        <div className="hero-banner-3d__watch">
          <div className="hero-banner-3d__strap hero-banner-3d__strap--top" />
          <div className="hero-banner-3d__strap hero-banner-3d__strap--bottom" />

          <div className="hero-banner-3d__dial-shell">
            <div className="hero-banner-3d__bezel-reflection" />
            <div className="hero-banner-3d__dial">
              <div className="hero-banner-3d__dial-glow" />
              <div className="hero-banner-3d__dial-cutout hero-banner-3d__dial-cutout--left" />
              <div className="hero-banner-3d__dial-cutout hero-banner-3d__dial-cutout--right" />

              {markers.map((marker) => {
                const angle = marker * 30;
                const isPrimary = marker % 3 === 0;

                return (
                  <span
                    key={marker}
                    className={`hero-banner-3d__marker ${
                      isPrimary ? "hero-banner-3d__marker--primary" : "hero-banner-3d__marker--secondary"
                    }`}
                    style={{
                      transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-82px)`,
                    }}
                  />
                );
              })}

              <div className="hero-banner-3d__subdial hero-banner-3d__subdial--lower" />
              <div className="hero-banner-3d__subdial hero-banner-3d__subdial--upper" />
              <div className="hero-banner-3d__hand hero-banner-3d__hand--hour" />
              <div className="hero-banner-3d__hand hero-banner-3d__hand--minute" />
              <div className="hero-banner-3d__hand hero-banner-3d__hand--second" />
              <div className="hero-banner-3d__pin" />
            </div>
          </div>

          <div className="hero-banner-3d__crown" />
          <div className="hero-banner-3d__reflection" />
          <div className="hero-banner-3d__annotation hero-banner-3d__annotation--top">
            <span>Private drop</span>
          </div>
          <div className="hero-banner-3d__annotation hero-banner-3d__annotation--bottom">
            <span>Mechanical depth</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={
          prefersReducedMotion
            ? undefined
            : { opacity: [0.24, 0.5, 0.24], scale: [0.94, 1.04, 0.94] }
        }
        className="hero-banner-3d__pulse"
        transition={{ duration: 4.8, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
      />

      <motion.div
        animate={
          prefersReducedMotion
            ? undefined
            : { x: ["-20%", "10%", "-20%"] }
        }
        className="hero-banner-3d__glint"
        transition={{ duration: 7.2, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
      />

      <div className="hero-banner-3d__ticker">
        <span>Edition 05</span>
        <span>Collector grade</span>
        <span>Swiss cadence</span>
      </div>
    </div>
  );
}
