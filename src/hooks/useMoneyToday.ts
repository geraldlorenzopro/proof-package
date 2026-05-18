/**
 * useMoneyToday — Hub Inicio v7 Zona 7 ("Dinero hoy")
 *
 * Stub inicial: la tabla `ghl_invoices` aún no existe. Devolvemos ceros
 * hasta que la integración de billing esté lista. Mantiene la API estable
 * para que la UI ya consuma este hook y luego no haya que tocarla.
 */
import { useEffect, useState } from "react";

export interface MoneyToday {
  collectedToday: number;
  pendingToday: number;
  contractsToday: number;
  loading: boolean;
  stub: boolean;
}

export function useMoneyToday(_accountId: string | null): MoneyToday {
  const [state, setState] = useState<MoneyToday>({
    collectedToday: 0,
    pendingToday: 0,
    contractsToday: 0,
    loading: true,
    stub: true,
  });

  useEffect(() => {
    // TODO: cuando exista ghl_invoices, query SUM(amount) WHERE paid_at::date = today
    // y COUNT(*) de contratos firmados hoy.
    setState({
      collectedToday: 0,
      pendingToday: 0,
      contractsToday: 0,
      loading: false,
      stub: true,
    });
  }, [_accountId]);

  return state;
}
