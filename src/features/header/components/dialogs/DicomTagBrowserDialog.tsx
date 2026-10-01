import type * as React from 'react'

import DicomTagBrowser from '../../../../components/DicomTagBrowser/DicomTagBrowser'
import {
  Dialog,
  DialogContent,
  SlimDialogHeader,
} from '../../../../components/ui/dialog'
import type DicomWebManager from '../../../../DicomWebManager'

export interface DicomTagBrowserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
  seriesInstanceUID?: string
  /** Patient and study label shown under the title */
  subtitle?: string
}

/** DICOM tag browser modal for the study open in the viewer. */
export function DicomTagBrowserDialog({
  open,
  onOpenChange,
  clients,
  studyInstanceUID,
  seriesInstanceUID,
  subtitle,
}: DicomTagBrowserDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[94vw] max-w-[1120px]">
        <SlimDialogHeader
          icon="manage_search"
          title="DICOM tag browser"
          subtitle={
            subtitle !== undefined && subtitle !== ''
              ? subtitle
              : studyInstanceUID
          }
        />
        <DicomTagBrowser
          clients={clients}
          studyInstanceUID={studyInstanceUID}
          seriesInstanceUID={seriesInstanceUID}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
