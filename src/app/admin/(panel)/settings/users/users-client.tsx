'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  FormMessage,
  INPUT,
  Label,
} from '@/components/admin/ui';
import { ASSIGNABLE_ROLES } from '@/lib/permissions';
import { ROLE_DESCRIPTION, ROLE_LABEL, type Role } from '@/lib/roles';

import {
  inviteUserAction,
  revokeInviteAction,
  setActiveAction,
  setRoleAction,
  type UsersActionState,
} from './actions';

/**
 * The interactive parts of `/admin/settings/users`.
 *
 * The page itself is a Server Component that reads the two lists; these are the
 * forms, split out because `useActionState` and `useFormStatus` are client
 * hooks. Every one of them posts to a server action that re-checks the session
 * and the role before doing anything (§12) — nothing here is a permission, it
 * is a control.
 */

const IDLE: UsersActionState = { error: null, success: null };

/* --------------------------------------------------------------------------
   Invite
   -------------------------------------------------------------------------- */

export function InviteForm() {
  const [state, formAction] = useActionState(inviteUserAction, IDLE);

  return (
    <form action={formAction} className="space-y-4 px-4 py-4 sm:px-5">
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state.success ? (
        <FormMessage tone="success">{state.success}</FormMessage>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="invite-name">Name</Label>
          <div className="mt-2">
            <input
              id="invite-name"
              name="name"
              type="text"
              required
              autoComplete="off"
              className={INPUT}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="invite-email">Email</Label>
          <div className="mt-2">
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              className={INPUT}
            />
          </div>
        </div>
      </div>

      <fieldset>
        {/* Radio buttons rather than a `<select>`. Three options, each of which
            needs a line of explanation to be chosen correctly — and a select
            can only show the explanation of the option already picked. */}
        <legend className="text-[0.8125rem] font-semibold text-ink">
          Role
        </legend>
        <div className="mt-2 space-y-2">
          {ASSIGNABLE_ROLES.map((role) => (
            <label
              key={role}
              className="flex min-h-11 cursor-pointer gap-3 rounded-[2px] border border-hairline bg-white p-3 has-checked:border-verdant"
            >
              <input
                type="radio"
                name="role"
                value={role}
                defaultChecked={role === 'executive'}
                className="mt-0.5 size-4 shrink-0 accent-verdant"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  {ROLE_LABEL[role]}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {ROLE_DESCRIPTION[role]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Submit className={BUTTON_PRIMARY} busy="Sending…">
        Send invitation
      </Submit>
    </form>
  );
}

/* --------------------------------------------------------------------------
   Row actions
   -------------------------------------------------------------------------- */

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const [state, formAction] = useActionState(revokeInviteAction, IDLE);

  return (
    <form action={formAction}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <Submit className={BUTTON_DANGER} busy="Withdrawing…">
        Withdraw
      </Submit>
      {state.error ? (
        <p role="alert" className="mt-2 text-xs text-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Change a role.
 *
 * A `<select>` plus an explicit Save, not a select that submits on change. An
 * accidental brush against a native picker on a phone would otherwise silently
 * demote a colleague, and there is no undo on this screen.
 */
export function RoleForm({
  userId,
  role,
}: {
  userId: string;
  role: Role;
}) {
  const [state, formAction] = useActionState(setRoleAction, IDLE);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />

      <label htmlFor={`role-${userId}`} className="sr-only">
        Role
      </label>
      <select
        id={`role-${userId}`}
        name="role"
        defaultValue={role}
        className={`${INPUT} w-auto`}
      >
        {ASSIGNABLE_ROLES.map((option) => (
          <option key={option} value={option}>
            {ROLE_LABEL[option]}
          </option>
        ))}
      </select>

      <Submit className={BUTTON_SECONDARY} busy="Saving…">
        Save
      </Submit>

      {state.error ? (
        <p role="alert" className="w-full text-xs text-error">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="w-full text-xs text-verdant">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

export function ActiveForm({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [state, formAction] = useActionState(setActiveAction, IDLE);

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="isActive" value={isActive ? 'false' : 'true'} />

      <Submit
        className={isActive ? BUTTON_DANGER : BUTTON_SECONDARY}
        busy="Saving…"
      >
        {isActive ? 'Deactivate' : 'Reactivate'}
      </Submit>

      {state.error ? (
        <p role="alert" className="mt-2 text-xs text-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/* --------------------------------------------------------------------------
   Shared
   -------------------------------------------------------------------------- */

/**
 * A submit button that disables itself while its own form is in flight.
 *
 * `useFormStatus` reads the nearest enclosing form, so this has to be a child
 * component — called from the form's own body it would always report idle. That
 * is also what keeps the rows on this page independent: deactivating one
 * account does not grey out the buttons on every other row.
 */
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
