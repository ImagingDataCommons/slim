import React from "react";
import { Menu } from "antd";
import AnnotationCategoryItem from "./AnnotationCategoryItem";

const AnnotationCategoryList = ({ annotationGroups, onChange, checkedAnnotationGroupUids }: any) => {
  const categoriesWithTypes = annotationGroups?.map((annotationGroup: any) => {
    const uid = annotationGroup.uid;
    const category = annotationGroup.propertyCategory.CodeMeaning;
    const type = annotationGroup.propertyType.CodeMeaning;
    return {
      uid,
      category,
      type,
    };
  });

  const uniqueCategoriesWithTypes = categoriesWithTypes.reduce(
    (acc: any, categoryWithType: any) => {
      const { category, type, uid } = categoryWithType;
      const oldCategoryEntry = acc[category] ?? {};
      const oldTypeEntry = oldCategoryEntry[type] ?? [];

      const uniqueUids = new Set([...oldTypeEntry, uid]);
      const uids = Array.from(uniqueUids);

      return { ...acc, [category]: { ...oldCategoryEntry, [type]: uids } };
    },
    {}
  );

  const categories = Object.keys(uniqueCategoriesWithTypes);

  if (categories.length === 0) {
    return <></>;
  }

  const items = categories.map((category: any) => {
    return (
      <AnnotationCategoryItem
        key={category}
        category={category}
        typesWithUids={uniqueCategoriesWithTypes[category]}
        onChange={onChange}
        checkedAnnotationGroupUids={checkedAnnotationGroupUids}
      />
    );
  });

  return <Menu selectable={false}>{items}</Menu>;
};
export default AnnotationCategoryList;
