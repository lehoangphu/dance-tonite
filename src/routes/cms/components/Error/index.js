/** @jsx h */
import { h } from 'preact';
import './style.scss';

export default ({ children }) => <div className="cms-error">Error: {children}</div>;
