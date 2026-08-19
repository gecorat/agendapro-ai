import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

// Sin API Key configurada (PlatformConfig.google_maps_api_key vacío), esto se comporta
// como un input de texto común — nada se rompe, solo no hay sugerencias al escribir.
let loadPromise = null;
function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.places) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return loadPromise;
}

export default function AddressAutocompleteInput({ value, onChange, onPlaceSelect, ...props }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke("getGoogleMapsKey", {});
        const apiKey = res?.data?.apiKey;
        if (!apiKey || cancelled) return;
        await loadGoogleMaps(apiKey);
        if (!cancelled) setReady(true);
      } catch {
        // sin key configurada, o falló la carga: seguimos como input de texto normal
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current || !window.google?.maps?.places) return;
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
    });
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current.getPlace();
      const formatted = place?.formatted_address || inputRef.current.value;
      const lat = place?.geometry?.location?.lat ? place.geometry.location.lat() : undefined;
      const lng = place?.geometry?.location?.lng ? place.geometry.location.lng() : undefined;
      onChange(formatted);
      if (onPlaceSelect) onPlaceSelect({ address: formatted, lat, lng });
    });
  }, [ready, onChange, onPlaceSelect]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={ready ? "Empezá a escribir tu dirección..." : "Ej. Av. Corrientes 1234, CABA"}
      {...props}
    />
  );
}
