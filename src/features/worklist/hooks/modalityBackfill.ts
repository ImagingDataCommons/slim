/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import type DicomWebManager from '../../../DicomWebManager'
import { mapWithConcurrency } from '../../../utils/mapWithConcurrency'
import { modalitiesNeedBackfill } from '../utils/filters'
import { extractModalitiesFromSeries } from '../utils/studyQuery'

const SERIES_REQUEST_CONCURRENCY = 6

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

/**
 * Modalities of the studies whose QIDO result lacked ModalitiesInStudy, read
 * from their series. Stops issuing requests once `isCurrent` turns false.
 */
export async function fetchMissingModalities(
  client: DicomWebManager,
  studies: dmv.metadata.Study[],
  isCurrent: () => boolean,
): Promise<ReadonlyMap<string, string[]>> {
  const needEnrichment = studies.filter(modalitiesNeedBackfill)
  const results = await mapWithConcurrency(
    needEnrichment,
    SERIES_REQUEST_CONCURRENCY,
    async (study) => {
      const uid = study.StudyInstanceUID
      if (!isCurrent()) return { uid, modalities: [] }
      return {
        uid,
        modalities: await collectModalitiesFromSeries(client, uid),
      }
    },
  )
  return new Map(results.map(({ uid, modalities }) => [uid, modalities]))
}

/** Studies whose modalities were backfilled from their series. */
export function mergeModalities(
  studies: dmv.metadata.Study[],
  modalitiesByUid: ReadonlyMap<string, string[]>,
): dmv.metadata.Study[] {
  return studies.map((study) => {
    const modalities = modalitiesByUid.get(study.StudyInstanceUID)
    if (
      modalities === undefined ||
      modalities.length === 0 ||
      !modalitiesNeedBackfill(study)
    ) {
      return study
    }
    return { ...study, ModalitiesInStudy: modalities }
  })
}
