import { cn } from "@/lib/utils";

interface AnimatedBackgroundProps {
  className?: string;
  children?: React.ReactNode;
}

export function AnimatedBackground({ className, children }: AnimatedBackgroundProps) {
  return (
    <div className={cn("relative min-h-screen overflow-hidden", className)}>
      {/* Base gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[hsl(224,15%,8%)] via-[hsl(224,12%,5%)] to-[hsl(224,20%,3%)]" />
      
      {/* Animated gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Primary lime glow - top right */}
        <div 
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-20 animate-float"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        
        {/* Secondary gold glow - bottom left */}
        <div 
          className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, hsl(var(--secondary) / 0.5) 0%, transparent 70%)',
            filter: 'blur(100px)',
            animation: 'float 4s ease-in-out infinite reverse',
          }}
        />
        
        {/* Accent lime glow - center left */}
        <div 
          className="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full opacity-10 animate-float"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animationDelay: '1s',
          }}
        />
        
        {/* Small accent orb - bottom right */}
        <div 
          className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, transparent 70%)',
            filter: 'blur(50px)',
            animation: 'float 5s ease-in-out infinite',
            animationDelay: '2s',
          }}
        />
      </div>
      
      {/* Subtle grid pattern overlay */}
      <div 
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      
      {/* Radial vignette */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, hsl(224 9% 6% / 0.4) 100%)',
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
