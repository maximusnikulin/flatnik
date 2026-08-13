import { useEffect, useState } from "react";
import { MapView } from "../features/map/ui/MapView";
import { SearchBar } from "../features/map/ui/SearchBar";
import { useMapStore } from "../features/map/model/map.store";
import { HousePanel } from "../features/houses/ui/HousePanel";
import { ReviewsPanel } from "../features/reviews/ui/ReviewsPanel";
import { MyReviewsPanel } from "../features/reviews/ui/MyReviewsPanel";
import { AuthModal } from "../features/auth/ui/AuthModal";
import { UserMenu } from "../features/auth/ui/UserMenu";
import { useAuthStore } from "../features/auth/model/auth.store";
import { ReviewFormModal } from "../features/review-form/ui/ReviewFormModal";
import { useReviewFormStore } from "../features/review-form/model/review-form.store";
import type { ReviewFormPrefill } from "../features/review-form/model/review-form.store";

/**
 * Медиатор экрана: карта — фон, слева поиск и панели дома, справа профиль
 * и его отзывы, поверх — модалки.
 * Фичи не импортируют друг друга; их связывает только этот компонент.
 */
export function App() {
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

  // Намерение «открыть форму после входа»: null — без префилла
  const [pendingPrefill, setPendingPrefill] = useState<
    ReviewFormPrefill | null | undefined
  >(undefined);

  // «Мои отзывы» живут в правой колонке независимо от панелей дома и квартиры
  const [isMyReviewsOpen, setMyReviewsOpen] = useState(false);

  // Квартира, отзыв о которой только что отправлен: публично он появится лишь
  // после модерации, и без объяснения панель выглядит так, будто отзыв пропал
  const [submittedApartmentId, setSubmittedApartmentId] = useState<string | null>(
    null,
  );

  // После выхода панель осталась бы висеть с ошибкой 401
  useEffect(() => {
    if (!token) setMyReviewsOpen(false);
  }, [token]);

  const handleAddReview = (prefill?: ReviewFormPrefill) => {
    if (!token) {
      setPendingPrefill(prefill ?? null);
      openAuthModal();
      return;
    }
    openForm(prefill);
  };

  useEffect(() => {
    if (token && pendingPrefill !== undefined) {
      openForm(pendingPrefill ?? undefined);
      setPendingPrefill(undefined);
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
      <div className="app__map">
        <MapView onSelectHouse={handleSelectHouse} />
      </div>

      <aside className="user-panel">
        <UserMenu onOpenMyReviews={() => setMyReviewsOpen((open) => !open)} />
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
        <SearchBar />
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
      <AuthModal />
    </div>
  );
}
