import { forwardRef } from 'react'
import { DocumentPreview } from './DocumentPreview'

interface BonLivraisonDocumentProps {
  bon: any;
  entreprise: any;
  /** BCP-47 language tag from i18n.language */
  lang?: string;
}

export const BonLivraisonDocument = forwardRef<HTMLDivElement, BonLivraisonDocumentProps>(
  ({ bon, entreprise, lang }, ref) => {
    if (!bon) return null
    return (
      <DocumentPreview
        ref={ref}
        type="bon_livraison"
        data={bon}
        entreprise={entreprise}
        lang={lang}
      />
    )
  }
)

BonLivraisonDocument.displayName = 'BonLivraisonDocument'
