// SR-006B true split: JSX/render logic moved to layer-panel/ sub-components.
// This file is now a thin compatibility wrapper.
export type { LayerPanelProps, AviationStats } from './layer-panel/layerPanelTypes';
import React from 'react';
import type { LayerPanelProps } from './layer-panel/layerPanelTypes';
import { LayerPanelRoot } from './layer-panel/LayerPanelRoot';

const LayerPanel: React.FC<LayerPanelProps> = (props) => <LayerPanelRoot {...props} />;

export default LayerPanel;
