import { Loader2 } from 'lucide-react';
import '../styles/Spinner.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

function Spinner({ size = 'md', text, className = '' }: SpinnerProps) {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 40,
  };

  return (
    <div className={`spinner-container ${className}`}>
      <Loader2 className="spinner-icon" size={sizeMap[size]} />
      {text && <span className="spinner-text">{text}</span>}
    </div>
  );
}

export default Spinner;
