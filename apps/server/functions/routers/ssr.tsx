import { Hono } from 'hono'
import { Content, Layout } from '../components/Layout'

const ssr = new Hono()

// Dynamic page route
ssr.get('/:name', (c) => {
  const { name } = c.req.param()
  const props = {
    name,
    siteData: {
      title: `Hello ${name} - JSX Sample 🐶`,
    },
  }
  return c.html(<Content {...props} />)
})

export default ssr
