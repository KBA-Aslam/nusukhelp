'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  Field,
  FormMessage,
  INPUT,
  Pill,
  SELECT,
} from '@/components/admin/ui';
import type {
  HotelRow,
  LookupRow,
  SimpleList,
} from '@/db/queries/lookups';
import { HOTEL_CATEGORIES, HOTEL_CITIES } from '@/db/schema';
import { formatSAR } from '@/lib/format';

import {
  saveHotelAction,
  saveLookupAction,
  setHotelActiveAction,
  setLookupActiveAction,
  type ListsActionState,
} from './actions';

/**
 * The five lookup lists, edited in place.
 *
 * ## One row expands at a time
 *
 * Each entry is a summary line with an Edit button that expands into the form.
 * §20.4 asks for exactly this on the booking form's repeaters, and the reasoning
 * carries: nine room types as nine simultaneous forms is unusable on a phone,
 * and this is the screen where that pattern gets built and proved before the
 * harder screen needs it.
 *
 * ## Retire, never delete
 *
 * The destructive-looking button says *Retire*, and it flips `isActive`. There
 * is no delete because from Phase 10 a booking snapshots what it used and the
 * foreign keys point back here — and because staff-entered data in this project
 * is retired rather than destroyed.
 */

const IDLE: ListsActionState = { error: null, success: null };

const CITY_LABEL: Record<(typeof HOTEL_CITIES)[number], string> = {
  makkah: 'Makkah',
  madinah: 'Madinah',
  jeddah: 'Jeddah',
  other: 'Other',
};

const CATEGORY_LABEL: Record<(typeof HOTEL_CATEGORIES)[number], string> = {
  economy: 'Economy',
  '1_star': '1 star',
  '2_star': '2 stars',
  '3_star': '3 stars',
  '4_star': '4 stars',
  '5_star': '5 stars',
};

/* --------------------------------------------------------------------------
   The four simple lists
   -------------------------------------------------------------------------- */

export function SimpleListEditor({
  list,
  rows,
  withCode = false,
  withPrice = false,
  nameLabel = 'Name',
}: {
  list: SimpleList;
  rows: LookupRow[];
  withCode?: boolean;
  withPrice?: boolean;
  nameLabel?: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div>
      <ul className="divide-y divide-hairline">
        {rows.map((row) => (
          <li key={row.id} className="px-4 py-3.5 sm:px-5">
            {editing === row.id ? (
              <LookupForm
                list={list}
                row={row}
                withCode={withCode}
                withPrice={withPrice}
                nameLabel={nameLabel}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                    {row.code ? (
                      <span className="font-mono text-xs font-semibold text-brass-ink">
                        {row.code}
                      </span>
                    ) : null}
                    <span className="font-semibold">{row.name}</span>
                    {row.isActive ? null : <Pill tone="neutral">Retired</Pill>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Order {row.sortOrder}
                    {withPrice
                      ? ` · ${row.defaultPrice === null ? 'no default price' : formatSAR(row.defaultPrice)}`
                      : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(row.id)}
                    className={BUTTON_SECONDARY}
                  >
                    Edit
                  </button>
                  <ActiveToggle
                    action={setLookupActiveAction}
                    hidden={{ list, id: row.id }}
                    isActive={row.isActive}
                  />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="border-t border-hairline bg-mist/40 px-4 py-4 sm:px-5">
        {editing === 'new' ? (
          <LookupForm
            list={list}
            row={null}
            withCode={withCode}
            withPrice={withPrice}
            nameLabel={nameLabel}
            onDone={() => setEditing(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className={BUTTON_SECONDARY}
          >
            Add an entry
          </button>
        )}
      </div>
    </div>
  );
}

function LookupForm({
  list,
  row,
  withCode,
  withPrice,
  nameLabel,
  onDone,
}: {
  list: SimpleList;
  row: LookupRow | null;
  withCode: boolean;
  withPrice: boolean;
  nameLabel: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(saveLookupAction, IDLE);
  const prefix = `${list}-${row?.id ?? 'new'}`;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="list" value={list} />
      {row ? <input type="hidden" name="id" value={row.id} /> : null}

      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {withCode ? (
          <Field id={`${prefix}-code`} label="Code" required>
            <input
              id={`${prefix}-code`}
              name="code"
              type="text"
              required
              maxLength={8}
              defaultValue={row?.code ?? ''}
              autoCapitalize="characters"
              className={INPUT}
            />
          </Field>
        ) : null}

        <Field id={`${prefix}-name`} label={nameLabel} required>
          <input
            id={`${prefix}-name`}
            name="name"
            type="text"
            required
            defaultValue={row?.name ?? ''}
            className={INPUT}
          />
        </Field>

        {withPrice ? (
          <Field
            id={`${prefix}-price`}
            label="Default price"
            hint="Whole Saudi Riyals. Leave empty for no default."
          >
            <input
              id={`${prefix}-price`}
              name="defaultPrice"
              type="number"
              min={0}
              step={1}
              // §20.3 — the decimal pad, which is what a price field wants even
              // though this one takes whole riyals: it puts the digits on the
              // primary layer without the spinner arrows a phone cannot use.
              inputMode="decimal"
              defaultValue={row?.defaultPrice ?? ''}
              aria-describedby={`${prefix}-price-hint`}
              className={INPUT}
            />
          </Field>
        ) : null}

        <Field
          id={`${prefix}-order`}
          label="Order"
          hint="Lower numbers appear first."
        >
          <input
            id={`${prefix}-order`}
            name="sortOrder"
            type="number"
            min={0}
            step={10}
            inputMode="numeric"
            defaultValue={row?.sortOrder ?? 0}
            aria-describedby={`${prefix}-order-hint`}
            className={INPUT}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Submit className={BUTTON_PRIMARY} busy="Saving…">
          Save
        </Submit>
        <button type="button" onClick={onDone} className={BUTTON_SECONDARY}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* --------------------------------------------------------------------------
   Hotels
   -------------------------------------------------------------------------- */

export function HotelListEditor({ rows }: { rows: HotelRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div>
      <ul className="divide-y divide-hairline">
        {rows.map((row) => (
          <li key={row.id} className="px-4 py-3.5 sm:px-5">
            {editing === row.id ? (
              <HotelForm row={row} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    <span className="truncate">{row.name}</span>
                    {row.isActive ? null : <Pill tone="neutral">Retired</Pill>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {row.city === 'other'
                      ? (row.cityOther ?? 'Other')
                      : CITY_LABEL[row.city]}
                    {row.category ? ` · ${CATEGORY_LABEL[row.category]}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(row.id)}
                    className={BUTTON_SECONDARY}
                  >
                    Edit
                  </button>
                  <ActiveToggle
                    action={setHotelActiveAction}
                    hidden={{ id: row.id }}
                    isActive={row.isActive}
                  />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="border-t border-hairline bg-mist/40 px-4 py-4 sm:px-5">
        {editing === 'new' ? (
          <HotelForm row={null} onDone={() => setEditing(null)} />
        ) : (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className={BUTTON_SECONDARY}
          >
            Add a hotel
          </button>
        )}
      </div>
    </div>
  );
}

function HotelForm({
  row,
  onDone,
}: {
  row: HotelRow | null;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(saveHotelAction, IDLE);
  const [city, setCity] = useState(row?.city ?? 'makkah');
  const prefix = `hotel-${row?.id ?? 'new'}`;

  return (
    <form action={formAction} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}

      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${prefix}-name`} label="Hotel name" required>
          <input
            id={`${prefix}-name`}
            name="name"
            type="text"
            required
            defaultValue={row?.name ?? ''}
            className={INPUT}
          />
        </Field>

        <Field id={`${prefix}-city`} label="City" required>
          <select
            id={`${prefix}-city`}
            name="city"
            value={city}
            onChange={(event) =>
              setCity(event.target.value as HotelRow['city'])
            }
            className={SELECT}
          >
            {HOTEL_CITIES.map((option) => (
              <option key={option} value={option}>
                {CITY_LABEL[option]}
              </option>
            ))}
          </select>
        </Field>

        {/* Only rendered for `other`, and the server clears the column for every
            other city — so correcting a city cannot leave a stale name behind. */}
        {city === 'other' ? (
          <Field id={`${prefix}-city-other`} label="Which city" required>
            <input
              id={`${prefix}-city-other`}
              name="cityOther"
              type="text"
              required
              defaultValue={row?.cityOther ?? ''}
              className={INPUT}
            />
          </Field>
        ) : null}

        <Field id={`${prefix}-category`} label="Category">
          <select
            id={`${prefix}-category`}
            name="category"
            defaultValue={row?.category ?? ''}
            className={SELECT}
          >
            <option value="">Not rated</option>
            {HOTEL_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {CATEGORY_LABEL[option]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Submit className={BUTTON_PRIMARY} busy="Saving…">
          Save
        </Submit>
        <button type="button" onClick={onDone} className={BUTTON_SECONDARY}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* --------------------------------------------------------------------------
   Shared
   -------------------------------------------------------------------------- */

function ActiveToggle({
  action,
  hidden,
  isActive,
}: {
  action: (
    state: ListsActionState,
    formData: FormData,
  ) => Promise<ListsActionState>;
  hidden: Record<string, string>;
  isActive: boolean;
}) {
  const [state, formAction] = useActionState(action, IDLE);

  return (
    <form action={formAction}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="isActive" value={isActive ? 'false' : 'true'} />

      <Submit
        className={isActive ? BUTTON_DANGER : BUTTON_SECONDARY}
        busy="Saving…"
      >
        {isActive ? 'Retire' : 'Restore'}
      </Submit>

      {state.error ? (
        <p role="alert" className="mt-1 text-xs text-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function Submit({
  className,
  busy,
  children,
}: {
  className: string;
  busy: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? busy : children}
    </button>
  );
}
