import React from "react";
import { NavLink } from "react-router-dom";
import { FaHome } from "react-icons/fa";
import { Avatar, Button, Col, Layout, Row, Space } from "antd";
import { UserOutlined } from "@ant-design/icons";

/** Providers */
import { withAuth } from "../providers/AuthProvider";
import { withApp } from "../providers/AppProvider";

interface HeaderProps {
  app: {
    info: {
      name: string;
      version: string;
      uid: string;
      organization?: string;
    }
  };
  user?: {
    name: string;
    email: string;
  };
}

/** React component for an application header. */
class Header extends React.Component<HeaderProps, {}> {
  render(): React.ReactNode {
    var user = null;
    if (this.props.user) {
      user = (
        <>
          <Avatar shape="square" icon={<UserOutlined />} />
          <span>
            {this.props.user.name} ({this.props.user.email})
          </span>
        </>
      );
    }
    return (
      <Layout.Header style={{ width: "100%", padding: "0 14px" }}>
        <Row>
          <Col>
            <Space align="center" direction="horizontal">
              <NavLink to="/">
                <Button icon={<FaHome />} />
              </NavLink>
              <span style={{ fontWeight: 600, fontSize: "large" }}>
                {this.props.app.info.name}
              </span>
            </Space>
          </Col>
          <Col flex="auto" />
          <Col>
            <Space align="center" direction="horizontal">
              {user}
            </Space>
          </Col>
        </Row>
      </Layout.Header>
    );
  }
}

export default withApp(withAuth(Header));
