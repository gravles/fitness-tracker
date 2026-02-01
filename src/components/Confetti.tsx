'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfettiPiece {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    size: number;
    opacity: number;
}

interface ConfettiProps {
    isActive: boolean;
    onComplete?: () => void;
    duration?: number;
    particleCount?: number;
}

const COLORS = [
    '#FFD700', // Gold
    '#FF6B6B', // Coral
    '#4ECDC4', // Teal
    '#A78BFA', // Purple
    '#60A5FA', // Blue
    '#34D399', // Green
    '#F472B6', // Pink
    '#FBBF24', // Amber
];

export function Confetti({
    isActive,
    onComplete,
    duration = 3000,
    particleCount = 100
}: ConfettiProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | undefined>(undefined);
    const particlesRef = useRef<ConfettiPiece[]>([]);

    const createParticles = useCallback((canvas: HTMLCanvasElement) => {
        const particles: ConfettiPiece[] = [];

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: -20 - Math.random() * 100,
                vx: (Math.random() - 0.5) * 8,
                vy: Math.random() * 3 + 2,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                size: Math.random() * 8 + 4,
                opacity: 1,
            });
        }
        return particles;
    }, [particleCount]);

    useEffect(() => {
        if (!isActive) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Create particles
        particlesRef.current = createParticles(canvas);
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particlesRef.current.forEach((p) => {
                // Update physics
                p.x += p.vx;
                p.vy += 0.1; // gravity
                p.y += p.vy;
                p.rotation += p.rotationSpeed;
                p.opacity = 1 - progress;

                // Draw particle
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                ctx.restore();
            });

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                onComplete?.();
            }
        };

        animate();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isActive, duration, createParticles, onComplete]);

    if (!isActive) return null;

    // Use portal to render at document root
    if (typeof document === 'undefined') return null;

    return createPortal(
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[9999]"
            aria-hidden="true"
        />,
        document.body
    );
}

/**
 * Hook for easy confetti triggering
 */
export function useConfetti() {
    const [isActive, setIsActive] = useState(false);

    const trigger = useCallback(() => {
        setIsActive(true);
    }, []);

    const handleComplete = useCallback(() => {
        setIsActive(false);
    }, []);

    return {
        isActive,
        trigger,
        handleComplete,
        ConfettiComponent: () => (
            <Confetti isActive={isActive} onComplete={handleComplete} />
        ),
    };
}
