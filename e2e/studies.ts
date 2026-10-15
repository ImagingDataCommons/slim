/**
 * Public IDC studies used by the manual test plan (e2e/TEST-PLAN.md) and the
 * Playwright specs. If IDC retires one, find a replacement with idc-index or a
 * QIDO query on the proxy and update both places.
 */

interface Series {
  study: string
  series: string
}

export const studies = {
  /** CPTAC-LSCC C3L-00965: 6 H&E slides with label and overview images */
  he: {
    study: '2.25.211094631316408413440371843585977094852',
    patientId: 'C3L-00965',
    firstSlide: '1.3.6.1.4.1.5962.99.1.215230799.1236847520.1640892770639.2.0',
  },
  /** TCGA-READ TCGA-AF-2689: binary and fractional TIL maps, nuclei SEG and ANN */
  tcgaRead: {
    study: '2.25.312916405820155829215771528638931942827',
    nucleiSeg:
      '1.2.826.0.1.3680043.10.511.3.11534436557194942782874737859569974',
    fractionalTilSeg:
      '1.2.826.0.1.3680043.10.511.3.44304577929953804027133272057932075',
    nucleiAnn:
      '1.2.826.0.1.3680043.10.511.3.65930042075829390210508226259517515',
  },
  /** TCGA-GBM TCGA-06-0130: parametric maps, SEG, ANN and an ICC profile */
  tcgaGbm: {
    study: '2.25.169142599340531625361659178384453215494',
    dx1Slide: '1.3.6.1.4.1.5962.99.1.1127304153.1690914100.1637509876697.2.0',
    parametricMap:
      '1.2.826.0.1.3680043.10.511.3.75366725734262349592517155782982171',
  },
  /** RMS-Mutation-Prediction RMS2203: 9 manual SR ROIs plus a fractional SEG */
  rmsSr: {
    study: '2.25.266314239954879564284639768519696615904',
    sr: '1.2.826.0.1.3680043.10.511.3.65352168153070950281170547035589843',
  },
  /** HTAN-WUSTL HTA12_3: 28-channel IMC slides, H&E and 9 presentation states */
  htanImc: {
    study: '2.25.289188443974026654725116153923555879592',
    imcSlide: '1.3.6.1.4.1.5962.99.1.1997905734.514527437.1655560347462.4.0',
  },
  /** Bone marrow WSI pediatric leukemia: rectangle ANN, 5 groups in 4 categories */
  boneMarrow: {
    study: '1.2.826.0.1.3680043.8.498.68164890741340078452950522749989442436',
    ann: '1.2.826.0.1.3680043.10.511.3.32704286069299586301112252202253953',
  },
  /** TCGA-STAD TCGA-BR-4201: JPEG 2000 compressed slide */
  jpeg2000: {
    study: '2.25.114227083156133646516769539915340013624',
    slide: '1.3.6.1.4.1.5962.99.1.2903380917.963766137.1639285953461.2.0',
  },
} as const

export function studyUrl(study: string): string {
  return `/studies/${study}`
}

export function seriesUrl({ study, series }: Series): string {
  return `/studies/${study}/series/${series}`
}
