import React from 'react';

const SparLogo: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => {
  return (
    <div className={`${className} flex items-center justify-center`}>
      <img 
        src="https://thespargroup.com/wp-content/uploads/photo-gallery/SPAR_Vertical_Logo.jpeg?bwg=1544795791"
        alt="SPAR Logo"
        className="w-full h-full object-contain"
      />
    </div>
  );
};

export default SparLogo;