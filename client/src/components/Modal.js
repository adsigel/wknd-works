import React from 'react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-inner">
          <div className="modal-header">
            <h2>{title}</h2>
            <button className="close-button" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="modal-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal; 