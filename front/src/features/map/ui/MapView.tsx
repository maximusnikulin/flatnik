import { useMemo, useRef, useState } from "react";
import type {
  DomEvent,
  DomEventHandlerObject,
  YMapLocationRequest,
} from "@yandex/ymaps3-types";
import { useYmaps, findAddressByPoint } from "../lib/ymaps";
import type { FoundAddress } from "../lib/ymaps";
import { useMapStore } from "../model/map.store";

/** Москва целиком, пока адрес не выбран */
const DEFAULT_LOCATION: YMapLocationRequest = {
  center: [37.6176, 55.7558],
  zoom: 11,
};

interface MapViewProps {
  /** Выбран дом — кликом по зданию или из списка в заглушке */
  onSelectHouse: (house: FoundAddress) => void;
}

export function MapView({ onSelectHouse }: MapViewProps) {
  const ymaps = useYmaps();
  const selectedAddress = useMapStore((s) => s.selectedAddress);
  const lastCenter = useMapStore((s) => s.lastCenter);
  const lastZoom = useMapStore((s) => s.lastZoom);
  const [note, setNote] = useState<string | null>(null);
  // Геокодирование асинхронно: пока летит ответ, пользователь может кликнуть
  // ещё раз. Применяем только результат последнего клика.
  const clickSeq = useRef(0);

  // Новый объект location на каждый рендер заставлял бы карту прыгать —
  // мемоизируем по lastCenter/lastZoom
  const location = useMemo<YMapLocationRequest>(
    () =>
      lastCenter
        ? {
            center: lastCenter,
            zoom: lastZoom ?? 17,
            duration: 400,
          }
        : DEFAULT_LOCATION,
    [lastCenter, lastZoom],
  );

  /**
   * Клик по зданию: точку превращаем в адрес и открываем по нему панель.
   * Сущность, слой и источник приходят первым аргументом, координаты — вторым.
   *
   * Геокодер платный и квотируемый, поэтому запрос уходит только для зданий.
   * Дом на схеме Яндекса — не наша сущность (`feature`), а hotspot слоя
   * `buildings`, так что фильтруем по слою, а не по типу объекта: клик по
   * земле, дороге или подписи до геокодера не доходит вовсе.
   */
  const handleClick = async (
    object: DomEventHandlerObject,
    event: DomEvent,
  ) => {
    // Фильтруем клики только по слою зданий
    // layer — строка вида "ymaps3-default-scheme:buildings"
    if (!object?.layer?.includes("buildings")) {
      // Клик по не-зданию — сбрасываем выбор
      useMapStore.getState().clearSelection();
      return;
    }

    const [lon, lat] = event.coordinates;
    const seq = ++clickSeq.current;
    setNote(null);

    const result = await findAddressByPoint(lon, lat);
    // Пока ждали ответ, пользователь кликнул по другому зданию
    if (seq !== clickSeq.current) return;

    if (result.status === "found") {
      onSelectHouse(result.address);
    } else if (result.status === "not-found") {
      setNote("Не удалось определить адрес этого здания.");
    } else {
      setNote(`Поиск адреса недоступен: ${result.message}`);
    }
  };

  if (ymaps.status !== "ready") {
    return (
      <div className="map-stub">
        {ymaps.status === "loading" && <p>Загружаем карту…</p>}
        {ymaps.status === "error" && (
          <p>Не удалось загрузить Яндекс Карты: {ymaps.message}</p>
        )}
        {ymaps.status === "disabled" && (
          <p>
            Карта отключена: не задан <code>VITE_YANDEX_MAPS_API_KEY</code>{" "}
            (см. .env.example).
          </p>
        )}
      </div>
    );
  }

  const {
    YMap,
    YMapDefaultSchemeLayer,
    YMapDefaultFeaturesLayer,
    YMapListener,
  } = ymaps.components;

  return (
    <>
      {note && <p className="map-note">{note}</p>}
      <YMap location={location} mode="vector">
        <YMapDefaultSchemeLayer />
        <YMapDefaultFeaturesLayer />
        {/*
          layer="any" слушает все клики, фильтр зданий — внутри обработчика.
          Пытались layer="buildings", но события не приходили вовсе.
        */}
        <YMapListener layer="any" onClick={handleClick} />
      </YMap>
    </>
  );
}
