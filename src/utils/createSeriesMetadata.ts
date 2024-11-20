import { Instance, Series } from '../services/DICOMMetadataStore'

function createSeriesMetadata (SeriesInstanceUID: string, defaultInstances?: Instance[]): Series {
  const instances: Instance[] = []
  const instancesMap = new Map<string, Instance>()

  return {
    SeriesInstanceUID,
    Modality: '',
    SeriesNumber: 0,
    SeriesDescription: '',
    SeriesDate: '',
    SeriesTime: '',
    ...defaultInstances?.[0],
    instances,
    addInstance: function (newInstance: Instance) {
      this.addInstances([newInstance])
    },
    addInstances: function (newInstances: Instance[]) {
      for (let i = 0, len = newInstances.length; i < len; i++) {
        const instance = newInstances[i]

        if (!instancesMap.has(instance.SOPInstanceUID)) {
          instancesMap.set(instance.SOPInstanceUID, instance)
          instances.push(instance)
        }
      }
    },
    getInstance: function (SOPInstanceUID: string) {
      return instancesMap.get(SOPInstanceUID)
    }
  }
}

export default createSeriesMetadata
