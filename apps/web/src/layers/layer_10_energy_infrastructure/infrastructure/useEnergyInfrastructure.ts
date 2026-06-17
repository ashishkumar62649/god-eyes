import { useState, useEffect, useRef } from 'react';
import { EnergyFeature, EnergyFilters, EnergyInfrastructureResponse } from './energyInfrastructureTypes';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000';

/**
 * Public slug used in API URLs for the Energy Infrastructure layer (per API-POLICY-001).
 * The internal layer ID `layer_10_energy_infrastructure` is preserved for folder
 * identity, UI registration, registry keys, and data-shape fields — it is
 * intentionally not used in the public API URL.
 */
const ENERGY_PUBLIC_SLUG = 'energy';


interface UseEnergyInfrastructureResult {
  features: EnergyFeature[];
  loading: boolean;
  error: string | null;
  metadata: EnergyInfrastructureResponse['metadata'] | null;
}

export function useEnergyInfrastructure(
  active: boolean,
  filters: EnergyFilters
): UseEnergyInfrastructureResult {
  const [features, setFeatures] = useState<EnergyFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<EnergyInfrastructureResponse['metadata'] | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active) {
      setFeatures([]);
      setLoading(false);
      setError(null);
      setMetadata(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Build query params from filters
        const params = new URLSearchParams();
        if (filters.featureType) params.append('featureType', filters.featureType);
        if (filters.category) params.append('category', filters.category);
        if (filters.sourceId) params.append('sourceId', filters.sourceId);
        if (filters.fuelType) params.append('fuelType', filters.fuelType);
        if (filters.pipelineProduct) params.append('pipelineProduct', filters.pipelineProduct);
        if (filters.country) params.append('country', filters.country);
        if (filters.minCapacityMw !== null) params.append('minCapacityMw', filters.minCapacityMw.toString());
        if (filters.maxCapacityMw !== null) params.append('maxCapacityMw', filters.maxCapacityMw.toString());
        if (filters.minVoltageKv !== null) params.append('minVoltageKv', filters.minVoltageKv.toString());
        if (filters.maxVoltageKv !== null) params.append('maxVoltageKv', filters.maxVoltageKv.toString());
        if (filters.status) params.append('status', filters.status);
        
        // Add safe default limit
        params.append('limit', '1000');
        
        const queryString = params.toString();
        const url = `${API_BASE_URL}/api/layers/${ENERGY_PUBLIC_SLUG}/infrastructure${queryString ? `?${queryString}` : ''}`;
        
        const response = await fetch(url, {
          signal: abortControllerRef.current?.signal,
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        const data: EnergyInfrastructureResponse = await response.json();
        setFeatures(data.features || []);
        setMetadata(data.metadata || null);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return; // Request was cancelled
        }
        console.error('Failed to fetch energy infrastructure:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch energy infrastructure data');
        setFeatures([]);
        setMetadata(null);
      } finally {
        setLoading(false);
      }
    };
    
    // Cancel any pending request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    fetchData();
    
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [active, filters]);
  
  return {
    features,
    loading,
    error,
    metadata
  };
}
