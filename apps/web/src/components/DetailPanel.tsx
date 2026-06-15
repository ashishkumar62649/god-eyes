// SR-006A true split: JSX/render logic moved to detail-panel/ sub-components.
// This file is now a thin compatibility wrapper.
export type { DetailPanelProps } from './detail-panel/detailTypes';
import React from 'react';
import type { DetailPanelProps } from './detail-panel/detailTypes';
import { DetailPanelRoot } from './detail-panel/DetailPanelRoot';

const DetailPanel: React.FC<DetailPanelProps> = (props) => <DetailPanelRoot {...props} />;

export default DetailPanel;
