/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { useEffect, useRef, useState } from 'react'

import type DicomWebManager from '../../../DicomWebManager'
import { mapWithConcurrency } from '../../../utils/mapWithConcurrency'
import { modalitiesNeedBackfill } from '../utils/filters'
import { extractModalitiesFromSeries } from '../utils/studyQuery'

const SERIES_REQUEST_CONCURRENCY = 6

const NO_MODALITIES: ReadonlyMap<string, string[]> = new Map()

async function collectModalitiesFromSeries(
  client: DicomWebManager,
  studyInstanceUID: string,
): Promise<string[]> {
  try {
    const seriesList = await client.searchForSeries({ studyInstanceUID })
    return extractModalitiesFromSeries(seriesList ?? [])
  } catch {
    return []
  }
}

interface Backfill {
  client: DicomWebManager | undefined
  modalitiesByUid: ReadonlyMap<string, string[]>
}

/**
 * Modalities read from the series of the given studies when their QIDO
 * result lacked ModalitiesInStudy (IDC never returns it). Costs one series
 * query per study, so callers pass only the rows on screen; answers are kept
 * per server, so revisiting a page sends nothing.
 */
export function useModalityBackfill(
  client: DicomWebManager | undefined,
  studies: readonly dmv.metadata.Study[],
): ReadonlyMap<string, string[]> {
  const [backfill, setBackfill] = useState<Backfill>({
    client,
    modalitiesByUid: NO_MODALITIES,
  })
  const modalitiesByUid =
    backfill.client === client ? backfill.modalitiesByUid : NO_MODALITIES

  /** Studies already asked about on `client`, including those still in flight */
  const requested = useRef<{
    client: DicomWebManager | undefined
    uids: Set<string>
  }>({ client, uids: new Set() })

  const missingKey =
    client === undefined
      ? ''
      : studies
          .filter(
            (study) =>
              modalitiesNeedBackfill(study) &&
              !modalitiesByUid.has(study.StudyInstanceUID),
          )
          .map((study) => study.StudyInstanceUID)
          .join('|')

  useEffect(() => {
    if (requested.current.client !== client) {
      requested.current = { client, uids: new Set() }
    }
    if (client === undefined || missingKey === '') return
    const asked = requested.current
    const uids = missingKey.split('|').filter((uid) => !asked.uids.has(uid))
    if (uids.length === 0) return
    for (const uid of uids) asked.uids.add(uid)

    /** A server switch drops the remaining requests; a page change keeps them */
    const isCurrent = (): boolean => requested.current === asked
    void mapWithConcurrency(uids, SERIES_REQUEST_CONCURRENCY, async (uid) => ({
      uid,
      modalities: isCurrent()
        ? await collectModalitiesFromSeries(client, uid)
        : [],
    })).then((results) => {
      if (!isCurrent()) return
      setBackfill((previous) => {
        const merged = new Map(
          previous.client === client ? previous.modalitiesByUid : [],
        )
        for (const { uid, modalities } of results) merged.set(uid, modalities)
        return { client, modalitiesByUid: merged }
      })
    })
  }, [client, missingKey])

  return modalitiesByUid
}
