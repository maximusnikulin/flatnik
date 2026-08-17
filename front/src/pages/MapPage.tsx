import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapView } from "../features/map/ui/MapView";
import { SearchBar } from "../features/map/ui/SearchBar";
import { useMapStore } from "../features/map/model/map.store";
import { HousePanel } from "../features/houses/ui/HousePanel";
import { ReviewsPanel } from "../features/reviews/ui/ReviewsPanel";
import { MyReviewsPanel } from "../features/reviews/ui/MyReviewsPanel";
import { UserMenu } from "../features/auth/ui/UserMenu";
import { useAuthStore } from "../features/auth/model/auth.store";
import { ReviewFormModal } from "../features/review-form/ui/ReviewFormModal";
import { useReviewFormStore } from "../features/review-form/model/review-form.store";
import type { ReviewFormPrefill } from "../features/review-form/model/review-form.store";
import { Footer } from "../features/legal/ui/Footer";
import { useDocumentMeta } from "../shared/lib/use-document-meta";
import { houseUrl } from "../shared/lib/house-url";
import { Logo } from "../shared/ui/Logo";

/**
 * Карта: сверху шапка с логотипом, поиском и профилем, под ней слева панели
 * дома, справа отзывы профиля, поверх — модалка отзыва. Фичи не импортируют
 * друг друга; их связывает эта страница.
 *
 * Состояние выбора живёт в map.store и в URL не отражается: карта — инструмент,
 * а не документ. Документы — страницы каталога, у них источник истины в адресе.
 */
export function MapPage() {
  const navigate = useNavigate();

  const selectedAddress = useMapStore((s) => s.selectedAddress);
  const selectedEntrance = useMapStore((s) => s.selectedEntrance);
  const selectedApartment = useMapStore((s) => s.selectedApartment);
  const selectAddress = useMapStore((s) => s.selectAddress);
  const selectEntrance = useMapStore((s) => s.selectEntrance);
  const clearEntrance = useMapStore((s) => s.clearEntrance);
  const selectApartment = useMapStore((s) => s.selectApartment);
  const clearApartment = useMapStore((s) => s.clearApartment);

  const token = useAuthStore((s) => s.token);
  const openAuthModal = useAuthStore((s) => s.openModal);

  const isFormOpen = useReviewFormStore((s) => s.isOpen);
  const openForm = useReviewFormStore((s) => s.open);
  const openEditForm = useReviewFormStore((s) => s.openEdit);
  const editTarget = useReviewFormStore((s) => s.editTarget);

  // Намерение «открыть форму после входа»; undefined — намерения нет
  const [pendingPrefill, setPendingPrefill] = useState<ReviewFormPrefill | undefined>(undefined)

  // «Мои отзывы» живут в правой колонке независимо от панелей дома и квартиры
  const [isMyReviewsOpen, setMyReviewsOpen] = useState(false);

  // Квартира, отзыв о которой только что отправлен: публично он появится лишь
  // после модерации, и без объяснения панель выглядит так, будто отзыв пропал
  const [submittedApartmentId, setSubmittedApartmentId] = useState<
    string | null
  >(null);

  useDocumentMeta({
    title: "Квартирник — отзывы жильцов о съёмных квартирах",
    description:
      "Карта отзывов о съёмных квартирах в Москве и Санкт-Петербурге: дом, подъезд, квартира и опыт бывших жильцов.",
    canonicalPath: "/",
  });

  // После выхода панель осталась бы висеть с ошибкой 401
  useEffect(() => {
    if (!token) setMyReviewsOpen(false);
  }, [token]);

  // Адрес нужен форме не только для показа: под ним лежит черновик,
  // поэтому без выбранного дома отзыв не начать
  const handleAddReview = (apartment?: { apartmentNumber: string; entrance: string }) => {
    if (!selectedAddress) return
    const prefill: ReviewFormPrefill = { address: selectedAddress.address, apartment }
    if (!token) {
      setPendingPrefill(prefill)
      openAuthModal()
      return
    }
    openForm(prefill);
  };

  useEffect(() => {
    if (token && pendingPrefill !== undefined) {
      openForm(pendingPrefill)
      setPendingPrefill(undefined)
    }
  }, [token, pendingPrefill, openForm]);

  // Дом выбран кликом по зданию на карте или из списка в заглушке
  const handleSelectHouse = (house: {
    address: string;
    lat: number;
    lon: number;
  }) => {
    selectAddress(house);
  };

  return (
    <div className="app">
      {/* Шапка в потоке, а не поверх карты: её высота задаёт верх обеих колонок,
          и на узком экране они не наезжают на переносящуюся строку поиска */}
      <header className="map-top">
        <Logo className="map-top__logo" />
        <SearchBar />
        <div className="map-top__user">
          <UserMenu onOpenMyReviews={() => setMyReviewsOpen((open) => !open)} />
        </div>
      </header>

      <div className="app__stage">
        <div className="app__map">
          <MapView onSelectHouse={handleSelectHouse} />
        </div>

        <aside className="user-panel">
          {isMyReviewsOpen && (
            <MyReviewsPanel
              onClose={() => setMyReviewsOpen(false)}
              onGoToHouse={selectAddress}
              onEdit={openEditForm}
              activeAddress={selectedAddress?.address ?? null}
            />
          )}
        </aside>

        <aside className="side-panel">
          {selectedAddress && !selectedApartment && (
            <HousePanel
              address={selectedAddress.address}
              entrance={selectedEntrance}
              onSelectEntrance={selectEntrance}
              onBackToEntrances={clearEntrance}
              onSelectApartment={(apartment) =>
                selectApartment({
                  id: apartment.id,
                  number: apartment.number,
                  entrance: apartment.entrance,
                })
              }
              onOpenHousePage={(slug) => navigate(houseUrl(slug))}
              onAddReview={() => handleAddReview()}
            />
          )}
          {selectedAddress && selectedApartment && (
            <ReviewsPanel
              apartmentId={selectedApartment.id}
              apartmentNumber={selectedApartment.number}
              entrance={selectedApartment.entrance}
              justSubmitted={selectedApartment.id === submittedApartmentId}
              onBack={clearApartment}
              onAddReview={() =>
                handleAddReview({
                  apartmentNumber: selectedApartment.number,
                  entrance: selectedApartment.entrance,
                })
              }
            />
          )}
        </aside>
      </div>

      <Footer />

      {isFormOpen && (editTarget || selectedAddress) && (
        <ReviewFormModal
          house={selectedAddress}
          onCreated={(apartment) => {
            setSubmittedApartmentId(apartment.id);
            selectApartment(apartment);
          }}
          onUnauthorized={openAuthModal}
        />
      )}
    </div>
  );
}
