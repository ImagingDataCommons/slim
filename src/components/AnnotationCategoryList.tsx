import React from "react";
import { Menu } from "antd";
import * as dmv from "dicom-microscopy-viewer";
import AnnotationCategoryItem from "./AnnotationCategoryItem";

export interface Type {
  CodeValue: string;
  CodeMeaning: string;
  CodingSchemeDesignator: string;
  uids: string[];
}
export interface Category {
  CodeValue: string;
  CodeMeaning: string;
  CodingSchemeDesignator: string;
  types: Type[];
}

const getCategories = (annotationGroups: any) => {
  const categories = annotationGroups?.reduce(
    (
      categoriesAcc: Record<string, Category & { types: Record<string, Type> }>,
      annotationGroup: dmv.annotation.AnnotationGroup
    ) => {
      const { propertyCategory, propertyType, uid } = annotationGroup;
      const categoryKey = propertyCategory.CodeMeaning;
      const typeKey = propertyType.CodeMeaning;

      const oldCategory = categoriesAcc[categoryKey] ?? {
        ...propertyCategory,
        types: {},
      };
      const oldType = oldCategory.types[typeKey] ?? {
        ...propertyType,
        uids: [],
      };

      return {
        ...categoriesAcc,
        [categoryKey]: {
          ...oldCategory,
          types: {
            ...oldCategory.types,
            [typeKey]: { ...oldType, uids: [...oldType.uids, uid] },
          },
        },
      };
    },
    {}
  );

  // Normalizing types so that it's an array instead of an object:
  Object.keys(categories).forEach((categoryKey: string) => {
    const category = categories[categoryKey];
    const { types } = category;
    const typesArr = Object.keys(types).map(
      (typeKey: string) => types[typeKey]
    );
    categories[categoryKey].types = typesArr;
  });

  return categories;
};

const AnnotationCategoryList = ({
  annotationGroups,
  onChange,
  checkedAnnotationGroupUids,
}: {
  annotationGroups: dmv.annotation.AnnotationGroup[];
  onChange: Function;
  checkedAnnotationGroupUids: Set<string>;
}) => {
  const categories: Record<string, Category> = getCategories(annotationGroups);

  if (Object.keys(categories).length === 0) {
    return <></>;
  }

  const items = Object.keys(categories).map((categoryKey: any) => {
    const category = categories[categoryKey];
    return (
      <AnnotationCategoryItem
        key={category.CodeMeaning}
        category={category}
        onChange={onChange}
        checkedAnnotationGroupUids={checkedAnnotationGroupUids}
      />
    );
  });

  return <Menu selectable={false}>{items}</Menu>;
};
export default AnnotationCategoryList;
