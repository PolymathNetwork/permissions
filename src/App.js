import React, { useContext, useEffect, Fragment } from 'react'
import { usePolymathSdk, User, Network, useTokenSelector} from '@polymathnetwork/react'
import { Feature } from '@polymathnetwork/sdk'
import { Store } from './index'
import { Layout, Spin, Alert, Button, Descriptions, Badge, Divider } from 'antd'
import PMDisplay from './PMDisplay'
import { _split } from './index'

const { Content, Header, Sider } = Layout

const PERMISSIONS_FEATURE = Feature.Permissions

export const reducer = (state, action) => {
  console.log('ACTION', action)
  switch (action.type) {
  case 'ASYNC_START':
    return {
      ...state,
      loading: true,
      loadingMessage: action.msg,
      error: undefined,
    }
  case 'ASYNC_COMPLETE':
    const { type, ...payload } = action
    return {
      ...state,
      ...payload,
      loading: false,
      loadingMessage: '',
      error: undefined
    }
  case 'ERROR':
  case 'ASYNC_ERROR':
    const { error } = action
    return {
      ...state,
      loading: false,
      loadingMessage: '',
      error,
    }
  case 'TOKEN_SELECTED':
    return {
      ...state,
      delegates: undefined,
      records: undefined,
      pmEnabled: undefined,
      error: undefined,
      features: undefined,
    }
  default:
    throw new Error(`Unrecognized action type: ${action.type}`)
  }
}

function Features({features, pmEnabled, onClick}) {
  return (
    <Descriptions column={4} style={{marginBottom: 50}}>
      <Descriptions.Item key='Permissions' label='Permissions'>
        { pmEnabled
          ? <Badge status='success' text='enabled' />
          : <Button type="primary" onClick={onClick}>Enable</Button> }
      </Descriptions.Item>
      }
      {Object.keys(features).map(feat => {
        return (<Descriptions.Item key={feat} label={_split(feat)}>
          <Badge status={features[feat] ? 'success' : 'error'} text={features[feat] ? 'enabled' : 'disabled'} />
        </Descriptions.Item>
        )}
      )}
    </Descriptions> )
}

async function asyncAction(dispatch, func, msg = '') {
  try {
    dispatch({type: 'ASYNC_START', msg})
    const rets = await func()
    dispatch({type: 'ASYNC_COMPLETE', ...rets})
  }
  catch (error) {
    dispatch({type: 'ASYNC_ERROR', error: error.message})
  }
}

function App() {
  const [state, dispatch] = useContext(Store)
  let {error: sdkError, sdk, networkId, walletAddress} = usePolymathSdk()
  let {
    error: tokenSelectorError,
    tokenSelector,
    tokens,
    tokenIndex,
  } = useTokenSelector(sdk, walletAddress)

  let {
    loading,
    loadingMessage,
    error,
    pmEnabled,
    records,
    features,
    availableRoles
  } = state.AppReducer
  const token = tokens[tokenIndex]

  error = error || sdkError || tokenSelectorError
  if (!error && !loadingMessage) {
    if (!sdk) {
      loading = true
      loadingMessage = 'Initializing Polymath SDK'
    }
    else if (!tokens.length) {
      loading = true
      loadingMessage = 'Loading your security tokens'
    }
  }

  // Load features status / available roles
  useEffect(() => {
    async function getFeaturesStatus() {
      const featuresStatus = await token.features.getStatus()
      let availableRoles = []
      const pmEnabled = featuresStatus[PERMISSIONS_FEATURE]
      delete featuresStatus[PERMISSIONS_FEATURE]
      if (pmEnabled) {
        availableRoles = await token.permissions.getAvailableRoles()
      }
      return {
        availableRoles, features: featuresStatus, pmEnabled
      }
    }
    if (token && !features) {
      asyncAction(dispatch, () => getFeaturesStatus(), 'Loading features status')
    }
  }, [dispatch, features, token])

  // Load delegates
  useEffect(() => {
    async function getDelegates() {
      const delegates = await token.permissions.getAllDelegates()
      const records = delegates.reduce((acc, delegate, i) => {
        return acc.concat(delegate.roles.map(role => ({
          address: delegates[i].address,
          description: delegates[i].description,
          role
        })))
      }, [])
      return {
        delegates,
        records
      }
    }
    if (token && pmEnabled) {
      asyncAction(dispatch, () => getDelegates(), 'Loading delegates')
    }
  }, [pmEnabled, dispatch, token])

  async function togglePM(enable) {
    try {
      dispatch({type: 'ASYNC_START', msg: 'Toggle role management'})
      if (enable) {
        // Enable module
        const queue = await token.features.enable({feature: PERMISSIONS_FEATURE})
        await queue.run()
      } else {
        // Disable module
        const queue = await token.features.disable({feature: PERMISSIONS_FEATURE})
        await queue.run()
      }
      dispatch({type: 'ASYNC_COMPLETE', pmEnabled: !enable})
      dispatch({type: 'TOKEN_SELECTED'})
    } catch (error) {
      console.error(error)
      dispatch({
        type: 'ASYNC_ERROR',
        error: error.message
      })
    }
  }

  const revokeRole = async (address, role) => {
    try {
      dispatch({type: 'ASYNC_START', msg: `Revoking ${role} role from ${address}`})
      const queue = await token.permissions.revokeRole({ delegateAddress: address, role })
      await queue.run()
      dispatch({type: 'ASYNC_COMPLETE'})
      dispatch({type: 'TOKEN_SELECTED'})
    } catch (error) {
      console.error(error)
      dispatch({
        type: 'ASYNC_ERROR',
        error: error.message
      })
    }
  }

  const assignRole = async (address, role, description) => {
    try {
      dispatch({type: 'ASYNC_START', msg: `Assigning ${role} role to ${address}`})
      const queue = await token.permissions.assignRole({ delegateAddress: address, role, description})
      await queue.run()
      dispatch({type: 'ASYNC_COMPLETE'})
      dispatch({type: 'TOKEN_SELECTED'})
    } catch (error) {
      console.error(error)
      dispatch({
        type: 'ASYNC_ERROR',
        error: error.message
      })
    }
  }

  return (
    <div>
      <Spin spinning={loading} tip={loadingMessage} size="large">
        <Layout>
          <Header style={{
            backgroundColor: 'white',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}>
            <Network networkId={networkId} />
            <User walletAddress={walletAddress} />
          </Header>
          <Layout>
            <Sider width={350}
              style={{
                padding: 50,
                backgroundColor: '#FAFDFF'
              }}
            >
              { walletAddress && tokens &&
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: 250,
                  justifyContent: 'flex-start'
                }}>
                  {tokenSelector({
                    onTokenSelect: () => dispatch({type: 'TOKEN_SELECTED'})
                  })}
                </div>
              }
            </Sider>
            <Content style={{
              padding: 50,
              backgroundColor: '#FAFDFF'
            }}>
              {error && <Alert
                message={error}
                type="error"
                closable
                showIcon
              />}
              { token && features &&
                <Fragment>
                  <Divider orientation="left">Token features</Divider>
                  <Features features={features} pmEnabled={pmEnabled} onClick={togglePM} />
                </Fragment> }
              { token && availableRoles && records && <React.Fragment>
                <Divider orientation="left">Delegates (administrators and operators)</Divider>

                <PMDisplay
                  records={records}
                  roles={availableRoles}
                  revokeRole={revokeRole}
                  assignRole={assignRole}/>
              </React.Fragment> }
            </Content>
          </Layout>
        </Layout>
      </Spin>
    </div>
  )
}

export default App
