/**
 * Layout System - Shared UI
 * Following FSD architecture - shared/ui layer
 * 
 * Responsive flexbox-based layout components
 * 
 * QUICK REFERENCE:
 * 
 * Container - Max-width wrapper with responsive padding
 *   <Container size="normal">...</Container>
 *   Sizes: narrow (800px), normal (1200px), wide (1440px), full (100%)
 * 
 * Flex - Flexbox container with full control
 *   <Flex direction="row" justify="space-between" align="center" gap="md">
 *     <FlexItem flex="1">Content</FlexItem>
 *   </Flex>
 * 
 * Stack - Simplified flex for vertical/horizontal stacking
 *   <Stack spacing="md">...</Stack>
 * 
 * Box - Card-like container with padding, shadow, and border
 *   <Box padding="lg" shadow="sm">...</Box>
 * 
 * Section - Page section with consistent vertical spacing
 *   <Section spacing="lg">...</Section>
 * 
 * See USAGE_EXAMPLES.jsx for complete examples
 */

export { Container } from './Container';
export { Flex } from './Flex';
export { FlexItem } from './FlexItem';
export { Stack } from './Stack';
export { Box } from './Box';
export { Section } from './Section';

import './Layout.css';

