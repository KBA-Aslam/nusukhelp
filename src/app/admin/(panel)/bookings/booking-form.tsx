'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  Card,
  Field,
  FormMessage,
  INPUT,
  SELECT,
  TEXTAREA,
} from '@/components/admin/ui';
import { computeBookingTotals } from '@/lib/booking-math';
import { formatSAR } from '@/lib/format';
import { dateStringToSeconds } from '@/lib/time';
import type { BookingValues } from '@/lib/validation/booking';

import {
  confirmBookingAction,
  saveBookingAction,
  saveDraftAction,
  type BookingActionResult,
  type FieldErrors,
} from './actions';

/**
 * The stepped booking form (§13.3, §20.4).
 *
 * This is the hardest screen in the panel to get right, and the reason is
 * §20 rather than §13: executives create bookings from a phone, standing in a
 * hotel lobby, and a single long form with two repeating groups is unusable at
 * 375 px. Seven short steps instead of one long screen; each room and service a
 * collapsible card; the running total pinned so it never needs scrolling to.
 *
 * ## Autosave is not polish
 *
 * The draft is a server-side row (§9.10), never browser storage. Losing twenty
 * minutes of entry to a dropped connection or an incoming call is the failure
 * mode that makes staff stop using a system altogether — and a draft that only
 * exists in one phone's browser is already lost when that happens.
 *
 * It saves on **two** triggers, not one. §20.4 asks for a save on step change;
 * that alone loses everything typed into the step someone is standing in when
 * the call they are on ends the session. So there is also a debounce — the
 * draft is written a second and a half after the last keystroke — and both go
 * through `persistDraft`, which holds an in-flight lock. That lock is the whole
 * reason the two triggers can coexist: without it, a debounce firing at the
 * same moment as a step change would call `createDraft` twice and leave two
 * half-finished bookings where the person made one. `beforeunload` covers the
 * remaining sliver.
 *
 * ## The running total is display only
 *
 * It comes from `lib/booking-math.ts`, which is the same arithmetic the server
 * runs — but every figure is recomputed server-side on save (§9.6), and
 * `recalculateBooking` is the only thing that writes one. Sharing the
 * expressions is not sharing the authority.
 */

/* --------------------------------------------------------------------------
   Shapes
   -------------------------------------------------------------------------- */

/**
 * Every field is a string, because every field is an `<input>`.
 *
 * The Zod schemas coerce and validate on the server, which is the only place
 * either matters (§15 — server authoritative). Keeping numbers as strings here
 * means an emptied price box is `''` rather than `NaN`, and a half-typed `12`
 * on the way to `120` is not rounded, reformatted or fought with while someone
 * is typing it.
 */
export type RoomFormValues = {
  roomTypeId: string;
  roomTypeName: string;
  mealPlanId: string;
  mealPlanCode: string;
  numberOfRooms: string;
  numberOfGuests: string;
  pricePerNight: string;
};

export type ServiceFormValues = {
  serviceTypeId: string;
  serviceName: string;
  quantity: string;
  unitPrice: string;
};

export type BookingFormValues = {
  agencyId: string;
  agencyName: string;
  contactPerson: string;
  agencyMobile: string;
  agencyWhatsapp: string;
  agencyEmail: string;
  agencyCountry: string;
  agencyAddress: string;

  guestName: string;
  guestMobile: string;
  guestEmail: string;
  guestCountry: string;

  hotelId: string;
  hotelName: string;
  hotelCity: string;
  hotelCategory: string;
  confirmationNumber: string;
  brnVrn: string;
  bookingSource: string;

  checkInDate: string;
  checkOutDate: string;

  rooms: RoomFormValues[];
  services: ServiceFormValues[];

  discountAmount: string;
  dueDate: string;
  notes: string;
};

export type BookingFormOptions = {
  agencies: {
    id: string;
    agencyName: string;
    contactPerson: string | null;
    mobile: string | null;
    whatsapp: string | null;
    email: string | null;
    country: string | null;
    address: string | null;
  }[];
  hotels: {
    id: string;
    name: string;
    city: string;
    cityOther: string | null;
    category: string | null;
  }[];
  roomTypes: { id: string; name: string }[];
  mealPlans: { id: string; code: string; name: string }[];
  serviceTypes: { id: string; name: string; defaultPrice: number | null }[];
};

export const EMPTY_BOOKING: BookingFormValues = {
  agencyId: '',
  agencyName: '',
  contactPerson: '',
  agencyMobile: '',
  agencyWhatsapp: '',
  agencyEmail: '',
  agencyCountry: '',
  agencyAddress: '',
  guestName: '',
  guestMobile: '',
  guestEmail: '',
  guestCountry: '',
  hotelId: '',
  hotelName: '',
  hotelCity: '',
  hotelCategory: '',
  confirmationNumber: '',
  brnVrn: '',
  bookingSource: '',
  checkInDate: '',
  checkOutDate: '',
  rooms: [],
  services: [],
  discountAmount: '0',
  dueDate: '',
  notes: '',
};

/**
 * How long after the last keystroke the draft is written.
 *
 * Long enough that ordinary typing is one request rather than thirty, short
 * enough that what a dropped connection costs is a word. A phone on hotel wifi
 * is the connection this is tuned for.
 */
const DRAFT_SAVE_DELAY_MS = 1500;

const STEPS = [
  'Agency',
  'Guest',
  'Hotel',
  'Stay',
  'Rooms',
  'Services',
  'Review',
] as const;

/* --------------------------------------------------------------------------
   The form
   -------------------------------------------------------------------------- */

export function BookingForm({
  bookingId,
  initial,
  options,
  mode,
  startStep = 0,
}: {
  /** Null on a brand-new booking; set once the first autosave has landed. */
  bookingId: string | null;
  initial: BookingFormValues;
  options: BookingFormOptions;
  /**
   * `create` runs the draft autosave and ends in **Confirm**, which allocates
   * the number (§9.1). `edit` never autosaves — a confirmed booking changes
   * only through `saveBookingAction`, which carries the §9.3 guards.
   */
  mode: 'create' | 'edit';
  /** From an agency profile: step 1 is pre-filled, so open on step 2 (§13.3). */
  startStep?: number;
}) {
  const [values, setValues] = useState<BookingFormValues>(initial);
  const [step, setStep] = useState(startStep);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = useRef(false);
  const set = useCallback(<K extends keyof BookingFormValues>(
    key: K,
    value: BookingFormValues[K],
  ) => {
    dirty.current = true;
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  /* --- What the autosave reads from -------------------------------------
     The debounce fires from inside a timer, where a captured `values` would be
     whatever it was when the timer was set. These refs hold the current state,
     so a save sends what is on the screen now rather than what was there a
     second and a half ago — which, on someone typing quickly, is a whole
     field. */
  const valuesRef = useRef(values);
  const draftIdRef = useRef<string | null>(bookingId);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  /**
   * The one place a draft is written. Both triggers call it.
   *
   * The in-flight lock matters more than it looks. `createDraft` runs whenever
   * `draftIdRef` is still null, so two overlapping saves on a new booking would
   * create two rows and the second would orphan the first — one draft the
   * person can see and one they cannot, which is a worse version of the bug
   * this whole mechanism exists to prevent. A save that arrives while one is
   * running sets `queuedRef` and runs again once there is an id to save over.
   *
   * `dirty` is cleared before the request and restored if it fails, so a failed
   * save is retried by the next keystroke rather than dropped, and edits made
   * *during* a save are not marked clean by its success.
   */
  const persistDraft = useCallback(async (): Promise<void> => {
    if (mode !== 'create') return;
    if (!dirty.current) return;

    const snapshot = valuesRef.current;
    // §8 makes `agency_name` NOT NULL, and a draft with no agency is one nobody
    // can identify in the Drafts list afterwards.
    if (!snapshot.agencyName.trim()) return;

    if (savingRef.current) {
      queuedRef.current = true;
      return;
    }

    savingRef.current = true;
    dirty.current = false;
    setSaving(true);

    try {
      const result = await saveDraftAction({
        id: draftIdRef.current,
        values: snapshot as unknown as BookingValues,
      });

      if (result.ok) {
        draftIdRef.current = result.id;
        setSaved(new Date().toLocaleTimeString());
        setMessage(null);
      } else if (result.kind !== 'confirm') {
        dirty.current = true;
        setMessage('message' in result ? result.message : null);
      }
    } catch {
      dirty.current = true;
      setMessage(
        'Could not reach the server — your last changes are not saved yet.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);

      if (queuedRef.current) {
        queuedRef.current = false;
        dirty.current = true;
        void persistDraft();
      }
    }
  }, [mode]);

  /* --- Trigger 2: a debounce while typing --------------------------------
     Beyond §20.4, which asks only for the step change. Staff fill this in on a
     phone in the middle of a conversation, and a step can be twenty fields
     long — so the step boundary on its own promises that what you typed is safe
     only if you happened to move on afterwards. Losing a step is a failure this
     project has already had once. */
  useEffect(() => {
    if (mode !== 'create') return;
    const timer = setTimeout(() => {
      void persistDraft();
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [values, mode, persistDraft]);

  /* --- Confirm before leaving (§20.4) ---
     Only when there is something to lose. A `beforeunload` handler that always
     fires trains people to dismiss it, which is worse than not having one. */
  useEffect(() => {
    if (mode === 'edit') return;
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [mode]);

  /* --- The running total (§13.3) --- */
  const totals = useMemo(
    () =>
      computeBookingTotals({
        checkInDate: dateStringToSeconds(values.checkInDate),
        checkOutDate: dateStringToSeconds(values.checkOutDate),
        rooms: values.rooms.map((room) => ({
          numberOfRooms: Number(room.numberOfRooms) || 0,
          numberOfGuests: Number(room.numberOfGuests) || 0,
          pricePerNight: Number(room.pricePerNight) || 0,
        })),
        services: values.services.map((service) => ({
          quantity: Number(service.quantity) || 0,
          unitPrice: Number(service.unitPrice) || 0,
        })),
        discountAmount: Number(values.discountAmount) || 0,
        vatAmount: 0,
        amountPaid: 0,
      }),
    [values],
  );

  function applyResult(result: BookingActionResult): boolean {
    if (result.ok) {
      setErrors({});
      setMessage(null);
      setWarnings(null);
      return true;
    }
    if (result.kind === 'invalid') {
      setErrors(result.fieldErrors);
      setMessage(result.message);
      setWarnings(null);
    } else if (result.kind === 'confirm') {
      setWarnings(result.warnings);
      setMessage(null);
    } else {
      setMessage(result.message);
      setWarnings(null);
    }
    return false;
  }

  /**
   * Trigger 1: save, then move (§20.4).
   *
   * The step changes whatever the save does. A failed autosave must not trap
   * someone on step 3 — the message says what happened, the edits stay dirty,
   * and the debounce tries again.
   */
  function goToStep(next: number) {
    const target = Math.max(0, Math.min(STEPS.length - 1, next));

    void persistDraft();

    setStep(target);
    window.scrollTo({ top: 0 });
  }

  /**
   * Confirm, or save an edit.
   *
   * The id comes from `draftIdRef`, **not** from the `draftId` state, and the
   * difference is a duplicate booking. A debounce that fires as someone reaches
   * for Confirm creates the draft row and then sets state; React delivers that
   * state on the next render, and a tap that lands in between would send
   * `id: null` and create a *second* booking — this time a numbered one. The
   * ref is set the moment the id is known.
   *
   * Waiting on `persistDraft` first also flushes whatever was typed inside the
   * debounce window, so Confirm never validates against a stale snapshot.
   */
  function submit(acknowledged = false) {
    startTransition(async () => {
      await persistDraft();

      const payload = valuesRef.current as unknown as BookingValues;
      const id = bookingId ?? draftIdRef.current;

      const result =
        mode === 'edit' && bookingId
          ? await saveBookingAction({ id: bookingId, values: payload, acknowledged })
          : await confirmBookingAction({ id: draftIdRef.current, values: payload });

      if (applyResult(result)) {
        dirty.current = false;
        // `confirmBookingAction` redirects and never returns; an edit stays put
        // and reloads so the detail screen shows the recalculated figures.
        window.location.assign(`/admin/bookings/${id}`);
      }
    });
  }

  function saveDraftOnly() {
    startTransition(async () => {
      const result = await saveDraftAction({
        id: draftIdRef.current,
        values: valuesRef.current as unknown as BookingValues,
      });
      if (result.ok) {
        dirty.current = false;
        draftIdRef.current = result.id;
        window.location.assign(`/admin/bookings/${result.id}`);
      } else {
        applyResult(result);
      }
    });
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div>
      <Stepper step={step} onStep={goToStep} />

      {message ? (
        <div className="mb-4">
          <FormMessage tone="error">{message}</FormMessage>
        </div>
      ) : null}

      {warnings ? (
        <div className="mb-4">
          <WarningPanel
            warnings={warnings}
            pending={pending}
            onCancel={() => setWarnings(null)}
            onProceed={() => submit(true)}
          />
        </div>
      ) : null}

      {step === 0 ? (
        <AgencyStep values={values} set={set} errors={errors} options={options} />
      ) : null}
      {step === 1 ? <GuestStep values={values} set={set} errors={errors} /> : null}
      {step === 2 ? (
        <HotelStep values={values} set={set} errors={errors} options={options} />
      ) : null}
      {step === 3 ? (
        <StayStep values={values} set={set} errors={errors} nights={totals.totalNights} />
      ) : null}
      {step === 4 ? (
        <RoomsStep
          values={values}
          set={set}
          errors={errors}
          options={options}
          nights={totals.totalNights}
        />
      ) : null}
      {step === 5 ? (
        <ServicesStep values={values} set={set} errors={errors} options={options} />
      ) : null}
      {step === 6 ? (
        <ReviewStep values={values} set={set} errors={errors} totals={totals} />
      ) : null}

      {/* --- Pinned total and actions (§20.3) --------------------------- */}
      <div
        className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-hairline bg-admin-ground/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <span className="text-xs text-muted">
            {totals.totalRooms} {totals.totalRooms === 1 ? 'room' : 'rooms'} ·{' '}
            {totals.totalNights} {totals.totalNights === 1 ? 'night' : 'nights'}
            {saving ? (
              <span className="ms-2">· saving…</span>
            ) : saved ? (
              <span className="ms-2">· draft saved {saved}</span>
            ) : null}
          </span>
          <span className="font-display text-lg text-ink">
            {formatSAR(totals.totalValue)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => goToStep(step - 1)}
            disabled={step === 0 || pending}
            className={BUTTON_SECONDARY}
          >
            Back
          </button>

          {isLast ? (
            <>
              <button
                type="button"
                onClick={() => submit()}
                disabled={pending}
                className={BUTTON_PRIMARY}
              >
                {mode === 'edit' ? 'Save changes' : 'Confirm booking'}
              </button>
              {mode === 'create' ? (
                <button
                  type="button"
                  onClick={saveDraftOnly}
                  disabled={pending}
                  className={BUTTON_SECONDARY}
                >
                  Save draft
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={() => goToStep(step + 1)}
              disabled={pending}
              className={BUTTON_PRIMARY}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Steps
   -------------------------------------------------------------------------- */

type StepProps = {
  values: BookingFormValues;
  set: <K extends keyof BookingFormValues>(
    key: K,
    value: BookingFormValues[K],
  ) => void;
  errors: FieldErrors;
};

function Stepper({
  step,
  onStep,
}: {
  step: number;
  onStep: (next: number) => void;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>
      {/* Dots rather than labels below `sm`: seven words do not fit at 360 px,
          and shortening them per breakpoint would fork the copy. */}
      <ol className="mt-2 flex gap-1.5">
        {STEPS.map((label, index) => (
          <li key={label} className="flex-1">
            <button
              type="button"
              onClick={() => onStep(index)}
              aria-current={index === step ? 'step' : undefined}
              className={`h-1.5 w-full rounded-[2px] ${
                index <= step ? 'bg-verdant' : 'bg-hairline'
              }`}
            >
              <span className="sr-only">{label}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AgencyStep({
  values,
  set,
  errors,
  options,
}: StepProps & { options: BookingFormOptions }) {
  /**
   * Choosing a saved agency copies its details into the booking (§9.5) rather
   * than leaving them to be read through the link. The fields stay editable
   * afterwards: this booking's contact may be someone else at the same agency,
   * and correcting it here must not rewrite the agency record.
   */
  function chooseAgency(id: string) {
    const agency = options.agencies.find((row) => row.id === id);
    set('agencyId', id);
    if (!agency) return;
    set('agencyName', agency.agencyName);
    set('contactPerson', agency.contactPerson ?? '');
    set('agencyMobile', agency.mobile ?? '');
    set('agencyWhatsapp', agency.whatsapp ?? '');
    set('agencyEmail', agency.email ?? '');
    set('agencyCountry', agency.country ?? '');
    set('agencyAddress', agency.address ?? '');
  }

  return (
    <Card title="Agency" description="Pick a saved agency, or type a new one.">
      <div className="space-y-5 px-4 py-5 sm:px-5">
        <Field id="agencyId" label="Saved agency">
          <select
            id="agencyId"
            className={SELECT}
            value={values.agencyId}
            onChange={(event) => chooseAgency(event.target.value)}
          >
            <option value="">Not listed — enter below</option>
            {options.agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.agencyName}
              </option>
            ))}
          </select>
        </Field>

        <Field id="agencyName" label="Agency name" required error={errors.agencyName}>
          <input
            id="agencyName"
            className={INPUT}
            value={values.agencyName}
            onChange={(event) => set('agencyName', event.target.value)}
            aria-invalid={Boolean(errors.agencyName)}
          />
        </Field>

        <Field id="contactPerson" label="Contact person" error={errors.contactPerson}>
          <input
            id="contactPerson"
            className={INPUT}
            value={values.contactPerson}
            onChange={(event) => set('contactPerson', event.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="agencyMobile" label="Mobile">
            <input
              id="agencyMobile"
              type="tel"
              className={INPUT}
              value={values.agencyMobile}
              onChange={(event) => set('agencyMobile', event.target.value)}
            />
          </Field>
          <Field id="agencyWhatsapp" label="WhatsApp">
            <input
              id="agencyWhatsapp"
              type="tel"
              className={INPUT}
              value={values.agencyWhatsapp}
              onChange={(event) => set('agencyWhatsapp', event.target.value)}
            />
          </Field>
          <Field id="agencyEmail" label="Email">
            <input
              id="agencyEmail"
              type="email"
              className={INPUT}
              value={values.agencyEmail}
              onChange={(event) => set('agencyEmail', event.target.value)}
            />
          </Field>
          <Field id="agencyCountry" label="Country">
            <input
              id="agencyCountry"
              className={INPUT}
              value={values.agencyCountry}
              onChange={(event) => set('agencyCountry', event.target.value)}
            />
          </Field>
        </div>

        <Field id="agencyAddress" label="Address">
          <textarea
            id="agencyAddress"
            className={TEXTAREA}
            value={values.agencyAddress}
            onChange={(event) => set('agencyAddress', event.target.value)}
          />
        </Field>
      </div>
    </Card>
  );
}

function GuestStep({ values, set, errors }: StepProps) {
  return (
    <Card title="Guest" description="The pilgrim travelling. Optional on a draft.">
      <div className="grid gap-5 px-4 py-5 sm:grid-cols-2 sm:px-5">
        <Field id="guestName" label="Guest name" error={errors.guestName}>
          <input
            id="guestName"
            className={INPUT}
            value={values.guestName}
            onChange={(event) => set('guestName', event.target.value)}
          />
        </Field>
        <Field id="guestMobile" label="Mobile">
          <input
            id="guestMobile"
            type="tel"
            className={INPUT}
            value={values.guestMobile}
            onChange={(event) => set('guestMobile', event.target.value)}
          />
        </Field>
        <Field id="guestEmail" label="Email">
          <input
            id="guestEmail"
            type="email"
            className={INPUT}
            value={values.guestEmail}
            onChange={(event) => set('guestEmail', event.target.value)}
          />
        </Field>
        <Field id="guestCountry" label="Country">
          <input
            id="guestCountry"
            className={INPUT}
            value={values.guestCountry}
            onChange={(event) => set('guestCountry', event.target.value)}
          />
        </Field>
      </div>
    </Card>
  );
}

const CITY_LABEL: Record<string, string> = {
  makkah: 'Makkah',
  madinah: 'Madinah',
  jeddah: 'Jeddah',
  other: 'Other',
};

function HotelStep({
  values,
  set,
  errors,
  options,
}: StepProps & { options: BookingFormOptions }) {
  function chooseHotel(id: string) {
    const hotel = options.hotels.find((row) => row.id === id);
    set('hotelId', id);
    if (!hotel) return;
    set('hotelName', hotel.name);
    set('hotelCity', hotel.city);
    set('hotelCategory', hotel.category ?? '');
  }

  return (
    <Card title="Hotel" description="From the list, or typed in for a one-off.">
      <div className="space-y-5 px-4 py-5 sm:px-5">
        <Field id="hotelId" label="Saved hotel">
          <select
            id="hotelId"
            className={SELECT}
            value={values.hotelId}
            onChange={(event) => chooseHotel(event.target.value)}
          >
            <option value="">Not listed — enter below</option>
            {options.hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name} · {CITY_LABEL[hotel.city] ?? hotel.cityOther ?? ''}
              </option>
            ))}
          </select>
        </Field>

        <Field id="hotelName" label="Hotel name" error={errors.hotelName}>
          <input
            id="hotelName"
            className={INPUT}
            value={values.hotelName}
            onChange={(event) => set('hotelName', event.target.value)}
            aria-invalid={Boolean(errors.hotelName)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="hotelCity" label="City">
            <select
              id="hotelCity"
              className={SELECT}
              value={values.hotelCity}
              onChange={(event) => set('hotelCity', event.target.value)}
            >
              <option value="">—</option>
              {Object.entries(CITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field id="bookingSource" label="Source">
            <select
              id="bookingSource"
              className={SELECT}
              value={values.bookingSource}
              onChange={(event) => set('bookingSource', event.target.value)}
            >
              <option value="">—</option>
              <option value="direct">Direct</option>
              <option value="allotment">Allotment</option>
              <option value="custom">Custom</option>
            </select>
          </Field>

          <Field id="confirmationNumber" label="Confirmation number">
            <input
              id="confirmationNumber"
              className={INPUT}
              value={values.confirmationNumber}
              onChange={(event) => set('confirmationNumber', event.target.value)}
            />
          </Field>

          <Field id="brnVrn" label="BRN / VRN">
            <input
              id="brnVrn"
              className={INPUT}
              value={values.brnVrn}
              onChange={(event) => set('brnVrn', event.target.value)}
            />
          </Field>
        </div>
      </div>
    </Card>
  );
}

function StayStep({
  values,
  set,
  errors,
  nights,
}: StepProps & { nights: number }) {
  return (
    <Card
      title="Stay"
      description="Nights are calculated from the two dates — they are never typed in."
    >
      <div className="grid gap-5 px-4 py-5 sm:grid-cols-2 sm:px-5">
        {/* Native pickers (§20.3). iOS and Android both provide good ones, and
            a custom calendar is worse on a phone and heavier in the bundle. */}
        <Field id="checkInDate" label="Check-in" required error={errors.checkInDate}>
          <input
            id="checkInDate"
            type="date"
            className={INPUT}
            value={values.checkInDate}
            onChange={(event) => set('checkInDate', event.target.value)}
            aria-invalid={Boolean(errors.checkInDate)}
          />
        </Field>

        <Field id="checkOutDate" label="Check-out" required error={errors.checkOutDate}>
          <input
            id="checkOutDate"
            type="date"
            className={INPUT}
            value={values.checkOutDate}
            onChange={(event) => set('checkOutDate', event.target.value)}
            aria-invalid={Boolean(errors.checkOutDate)}
          />
        </Field>

        <p className="text-sm text-muted sm:col-span-2">
          {nights > 0
            ? `${nights} ${nights === 1 ? 'night' : 'nights'}`
            : 'Enter both dates to see the number of nights.'}
        </p>
      </div>
    </Card>
  );
}

/* --- Repeaters ----------------------------------------------------------- */

function RoomsStep({
  values,
  set,
  errors,
  options,
  nights,
}: StepProps & { options: BookingFormOptions; nights: number }) {
  const [open, setOpen] = useState<number | null>(values.rooms.length === 0 ? 0 : null);

  function update(index: number, patch: Partial<RoomFormValues>) {
    set(
      'rooms',
      values.rooms.map((room, position) =>
        position === index ? { ...room, ...patch } : room,
      ),
    );
  }

  function add() {
    set('rooms', [
      ...values.rooms,
      {
        roomTypeId: '',
        roomTypeName: '',
        mealPlanId: '',
        mealPlanCode: '',
        numberOfRooms: '1',
        numberOfGuests: '1',
        pricePerNight: '',
      },
    ]);
    setOpen(values.rooms.length);
  }

  return (
    <Card
      title="Rooms"
      description="Add as many as the booking needs. Each row is rooms × nights × price."
    >
      <div className="space-y-3 px-4 py-5 sm:px-5">
        {values.rooms.length === 0 ? (
          <p className="text-sm text-muted">No rooms yet.</p>
        ) : null}

        {values.rooms.map((room, index) => {
          const subtotal =
            (Number(room.numberOfRooms) || 0) *
            nights *
            (Number(room.pricePerNight) || 0);

          return (
            <LineCard
              key={index}
              open={open === index}
              onToggle={() => setOpen(open === index ? null : index)}
              summary={
                room.roomTypeName
                  ? `${room.roomTypeName} × ${room.numberOfRooms || 0} — ${formatSAR(subtotal)}`
                  : 'New room'
              }
              onRemove={() =>
                set(
                  'rooms',
                  values.rooms.filter((_, position) => position !== index),
                )
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id={`room-${index}-type`}
                  label="Room type"
                  required
                  error={errors[`rooms.${index}.roomTypeName`]}
                >
                  <select
                    id={`room-${index}-type`}
                    className={SELECT}
                    value={room.roomTypeId}
                    onChange={(event) => {
                      const type = options.roomTypes.find(
                        (row) => row.id === event.target.value,
                      );
                      update(index, {
                        roomTypeId: event.target.value,
                        roomTypeName: type?.name ?? room.roomTypeName,
                      });
                    }}
                  >
                    <option value="">Other — type below</option>
                    {options.roomTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field id={`room-${index}-name`} label="As it appears on the invoice">
                  <input
                    id={`room-${index}-name`}
                    className={INPUT}
                    value={room.roomTypeName}
                    onChange={(event) =>
                      update(index, { roomTypeName: event.target.value })
                    }
                  />
                </Field>

                <Field id={`room-${index}-meal`} label="Meal plan">
                  <select
                    id={`room-${index}-meal`}
                    className={SELECT}
                    value={room.mealPlanId}
                    onChange={(event) => {
                      const plan = options.mealPlans.find(
                        (row) => row.id === event.target.value,
                      );
                      update(index, {
                        mealPlanId: event.target.value,
                        mealPlanCode: plan?.code ?? '',
                      });
                    }}
                  >
                    <option value="">—</option>
                    {options.mealPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.code} · {plan.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  id={`room-${index}-rooms`}
                  label="Rooms"
                  error={errors[`rooms.${index}.numberOfRooms`]}
                >
                  <input
                    id={`room-${index}-rooms`}
                    inputMode="numeric"
                    className={INPUT}
                    value={room.numberOfRooms}
                    onChange={(event) =>
                      update(index, { numberOfRooms: event.target.value })
                    }
                  />
                </Field>

                <Field
                  id={`room-${index}-guests`}
                  label="Guests"
                  error={errors[`rooms.${index}.numberOfGuests`]}
                >
                  <input
                    id={`room-${index}-guests`}
                    inputMode="numeric"
                    className={INPUT}
                    value={room.numberOfGuests}
                    onChange={(event) =>
                      update(index, { numberOfGuests: event.target.value })
                    }
                  />
                </Field>

                <Field
                  id={`room-${index}-price`}
                  label="Price per night (SAR)"
                  hint="Whole Riyals."
                  error={errors[`rooms.${index}.pricePerNight`]}
                >
                  <input
                    id={`room-${index}-price`}
                    inputMode="decimal"
                    className={INPUT}
                    value={room.pricePerNight}
                    onChange={(event) =>
                      update(index, { pricePerNight: event.target.value })
                    }
                  />
                </Field>

                <p className="text-sm text-muted sm:col-span-2">
                  {room.numberOfRooms || 0} × {nights}{' '}
                  {nights === 1 ? 'night' : 'nights'} ×{' '}
                  {formatSAR(Number(room.pricePerNight) || 0)} ={' '}
                  <strong className="text-ink">{formatSAR(subtotal)}</strong>
                </p>
              </div>
            </LineCard>
          );
        })}

        <button type="button" onClick={add} className={BUTTON_SECONDARY}>
          + Add room
        </button>

        {errors.rooms ? (
          <p className="text-xs text-error">{errors.rooms}</p>
        ) : null}
      </div>
    </Card>
  );
}

function ServicesStep({
  values,
  set,
  errors,
  options,
}: StepProps & { options: BookingFormOptions }) {
  const [open, setOpen] = useState<number | null>(null);

  function update(index: number, patch: Partial<ServiceFormValues>) {
    set(
      'services',
      values.services.map((service, position) =>
        position === index ? { ...service, ...patch } : service,
      ),
    );
  }

  return (
    <Card
      title="Extra services"
      description="Transfers, ziyarat, extra beds — anything charged on top of the rooms."
    >
      <div className="space-y-3 px-4 py-5 sm:px-5">
        {values.services.length === 0 ? (
          <p className="text-sm text-muted">No extra services.</p>
        ) : null}

        {values.services.map((service, index) => {
          const total =
            (Number(service.quantity) || 0) * (Number(service.unitPrice) || 0);

          return (
            <LineCard
              key={index}
              open={open === index}
              onToggle={() => setOpen(open === index ? null : index)}
              summary={
                service.serviceName
                  ? `${service.serviceName} × ${service.quantity || 0} — ${formatSAR(total)}`
                  : 'New service'
              }
              onRemove={() =>
                set(
                  'services',
                  values.services.filter((_, position) => position !== index),
                )
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`service-${index}-type`} label="Service">
                  <select
                    id={`service-${index}-type`}
                    className={SELECT}
                    value={service.serviceTypeId}
                    onChange={(event) => {
                      const type = options.serviceTypes.find(
                        (row) => row.id === event.target.value,
                      );
                      update(index, {
                        serviceTypeId: event.target.value,
                        serviceName: type?.name ?? service.serviceName,
                        // The lookup price is a *default* (§8) — it fills the
                        // box and the booking stores whatever was charged.
                        unitPrice:
                          type?.defaultPrice != null
                            ? String(type.defaultPrice)
                            : service.unitPrice,
                      });
                    }}
                  >
                    <option value="">Other — type below</option>
                    {options.serviceTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  id={`service-${index}-name`}
                  label="As it appears on the invoice"
                  required
                  error={errors[`services.${index}.serviceName`]}
                >
                  <input
                    id={`service-${index}-name`}
                    className={INPUT}
                    value={service.serviceName}
                    onChange={(event) =>
                      update(index, { serviceName: event.target.value })
                    }
                  />
                </Field>

                <Field
                  id={`service-${index}-qty`}
                  label="Quantity"
                  error={errors[`services.${index}.quantity`]}
                >
                  <input
                    id={`service-${index}-qty`}
                    inputMode="numeric"
                    className={INPUT}
                    value={service.quantity}
                    onChange={(event) =>
                      update(index, { quantity: event.target.value })
                    }
                  />
                </Field>

                <Field
                  id={`service-${index}-price`}
                  label="Unit price (SAR)"
                  error={errors[`services.${index}.unitPrice`]}
                >
                  <input
                    id={`service-${index}-price`}
                    inputMode="decimal"
                    className={INPUT}
                    value={service.unitPrice}
                    onChange={(event) =>
                      update(index, { unitPrice: event.target.value })
                    }
                  />
                </Field>

                <p className="text-sm text-muted sm:col-span-2">
                  Total <strong className="text-ink">{formatSAR(total)}</strong>
                </p>
              </div>
            </LineCard>
          );
        })}

        <button
          type="button"
          onClick={() => {
            set('services', [
              ...values.services,
              { serviceTypeId: '', serviceName: '', quantity: '1', unitPrice: '' },
            ]);
            setOpen(values.services.length);
          }}
          className={BUTTON_SECONDARY}
        >
          + Add extra service
        </button>
      </div>
    </Card>
  );
}

function ReviewStep({
  values,
  set,
  errors,
  totals,
}: StepProps & { totals: ReturnType<typeof computeBookingTotals> }) {
  return (
    <div className="space-y-5">
      <Card title="Totals">
        <dl className="divide-y divide-hairline text-sm">
          <Row label="Rooms" value={formatSAR(totals.roomsSubtotal)} />
          <Row label="Services" value={formatSAR(totals.servicesSubtotal)} />
          <Row
            label="Discount"
            value={`− ${formatSAR(Number(values.discountAmount) || 0)}`}
          />
          <Row label="Total" value={formatSAR(totals.totalValue)} strong />
        </dl>
      </Card>

      <Card title="Final details">
        <div className="grid gap-5 px-4 py-5 sm:grid-cols-2 sm:px-5">
          <Field
            id="discountAmount"
            label="Discount (SAR)"
            error={errors.discountAmount}
          >
            <input
              id="discountAmount"
              inputMode="decimal"
              className={INPUT}
              value={values.discountAmount}
              onChange={(event) => set('discountAmount', event.target.value)}
              aria-invalid={Boolean(errors.discountAmount)}
            />
          </Field>

          <Field id="dueDate" label="Payment due">
            <input
              id="dueDate"
              type="date"
              className={INPUT}
              value={values.dueDate}
              onChange={(event) => set('dueDate', event.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field id="notes" label="Notes / special requests">
              <textarea
                id="notes"
                className={TEXTAREA}
                value={values.notes}
                onChange={(event) => set('notes', event.target.value)}
              />
            </Field>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Pieces
   -------------------------------------------------------------------------- */

/**
 * A repeater row: a one-line summary when collapsed, the fields when open
 * (§20.4). Ten room rows expanded at once on a phone is unmanageable, and the
 * summary is what makes a list of them readable at a glance.
 */
function LineCard({
  open,
  onToggle,
  summary,
  onRemove,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  summary: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2px] border border-hairline">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-h-11 flex-1 items-center px-3.5 text-start text-sm font-semibold text-ink"
        >
          {summary}
        </button>
        {/* 44px, because these are the two controls §20.3 singles out as the
            easiest to make too small. */}
        <button
          type="button"
          onClick={onRemove}
          className="me-1.5 inline-flex size-11 items-center justify-center rounded-[2px] text-error"
        >
          <span aria-hidden="true">×</span>
          <span className="sr-only">Remove</span>
        </button>
      </div>

      {open ? (
        <div className="border-t border-hairline px-3.5 py-4">{children}</div>
      ) : null}
    </div>
  );
}

/**
 * The §9.3 warnings.
 *
 * Shown, acknowledged, and then the save proceeds — never a block. The two
 * cases are an overpayment that may need refunding and an edit to a completed
 * booking that will move a closed month's figures, and both are things a person
 * sometimes means to do.
 */
function WarningPanel({
  warnings,
  pending,
  onCancel,
  onProceed,
}: {
  warnings: string[];
  pending: boolean;
  onCancel: () => void;
  onProceed: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-[2px] border border-brass/40 bg-brass/5 px-4 py-3.5"
    >
      <ul className="space-y-1.5 text-sm text-ink">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={onProceed}
          disabled={pending}
          className={BUTTON_DANGER}
        >
          Save anyway
        </button>
        <button type="button" onClick={onCancel} className={BUTTON_SECONDARY}>
          Go back
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
      <dt className={strong ? 'font-semibold text-ink' : 'text-muted'}>{label}</dt>
      <dd className={strong ? 'font-display text-lg text-ink' : 'text-ink'}>
        {value}
      </dd>
    </div>
  );
}
