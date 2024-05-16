import React from "react";
import { Menu, Space, Checkbox } from "antd";

const AnnotationGroupItem = ({
  category,
  typesWithUids,
  onChange,
  checkedAnnotationGroupUids,
}: any) => {
  const types = Object.keys(typesWithUids);

  const onCheckCategoryChange = (e: any) => {
    const isVisible = e.target.checked;
    types.forEach((type) => {
      handleChangeCheckedType({ type, isVisible });
    });
  };

  const checkAll = Object.keys(typesWithUids).every((type) =>
    typesWithUids[type].every((uid: any) => checkedAnnotationGroupUids.has(uid))
  );
  const indeterminate =
    !checkAll &&
    Object.keys(typesWithUids).some((type) =>
      typesWithUids[type].some((uid: any) =>
        checkedAnnotationGroupUids.has(uid)
      )
    );

  const handleChangeCheckedType = ({ type, isVisible }: any) => {
    const uids = typesWithUids[type];
    uids.forEach((uid: any) => {
      onChange({ annotationGroupUID: uid, isVisible });
    });
  };

  return (
    <Menu.Item style={{ height: "100%", paddingLeft: "3px" }} key={category}>
      <Space align="start">
        <div style={{ paddingLeft: "14px" }}>
          <Space direction="vertical" align="end">
            <Checkbox
              indeterminate={indeterminate}
              checked={checkAll}
              onChange={onCheckCategoryChange}
            >
              {category}
            </Checkbox>
          </Space>
          {types.map((type: any) => {
            const isChecked = typesWithUids[type].every((uid: any) =>
              checkedAnnotationGroupUids.has(uid)
            );
            const indeterminateType =
              !isChecked &&
              typesWithUids[type].some((uid: any) =>
                checkedAnnotationGroupUids.has(uid)
              );
            return (
              <div style={{ paddingLeft: "25px" }}>
                <Checkbox
                  indeterminate={indeterminateType}
                  checked={isChecked}
                  onChange={(e: any) =>
                    handleChangeCheckedType({
                      type,
                      isVisible: e.target.checked,
                    })
                  }
                >
                  {type}
                </Checkbox>
              </div>
            );
          })}
        </div>
      </Space>
    </Menu.Item>
  );
};

export default AnnotationGroupItem;
